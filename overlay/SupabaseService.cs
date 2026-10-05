using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace JMBNOverlay;

internal sealed class SupabaseService
{
    readonly HttpClient http = new();
    string? accessToken;
    static readonly SemaphoreSlim signInGate = new(1, 1); // serialize Discord auth attempts
    internal string? UserId { get; private set; }

    static string B64(byte[] b)=>Convert.ToBase64String(b).TrimEnd('=').Replace('+','-').Replace('/','_');
    static string RandomToken(){var b=new byte[32];RandomNumberGenerator.Fill(b);return B64(b);}

    public async Task SignInWithDiscordAsync()
    {
        if (!await signInGate.WaitAsync(0)) throw new InvalidOperationException("Discord sign-in is already in progress.");
        try
        {
            const string redirect="http://127.0.0.1:54327/";
            using var listener=new HttpListener(); listener.Prefixes.Add(redirect);
            try { listener.Start(); }
            catch (HttpListenerException ex) { throw new InvalidOperationException("JMBN sign-in is already open in another process. Close any other JMBN Companion window and try again.", ex); }
            var state=RandomToken();
            var handoff="https://delumenta.github.io/onthego/overlay-auth.html?port=54327&state="+Uri.EscapeDataString(state);
            try { Process.Start(new ProcessStartInfo(handoff){UseShellExecute=true}); }
            catch (Exception ex) { throw new InvalidOperationException("Could not open your browser for Discord sign-in.", ex); }
            var ctx=await listener.GetContextAsync(); var returnedState=ctx.Request.QueryString["state"]; var token=ctx.Request.QueryString["access_token"];
            var html="<html><body style='background:#080a08;color:#d7b66a;font-family:sans-serif;padding:40px'><h2>JMBN MANIFEST LINKED</h2><p>You can return to the companion app.</p><script>window.close()</script></body></html>";
            var bytes=Encoding.UTF8.GetBytes(html);ctx.Response.ContentType="text/html";ctx.Response.ContentLength64=bytes.Length;await ctx.Response.OutputStream.WriteAsync(bytes);ctx.Response.Close();
            if(string.IsNullOrWhiteSpace(token)||returnedState!=state)throw new InvalidOperationException("Discord sign-in was not completed.");
            accessToken=token;
            using var req=new HttpRequestMessage(HttpMethod.Get,SupabaseConfig.Url+"/auth/v1/user");req.Headers.Add("apikey",SupabaseConfig.ApiKey);req.Headers.Authorization=new AuthenticationHeaderValue("Bearer",accessToken);
            using var res=await http.SendAsync(req);if(!res.IsSuccessStatusCode)throw new InvalidOperationException("Manifest session could not be verified.");
            using var doc=JsonDocument.Parse(await res.Content.ReadAsStringAsync());UserId=doc.RootElement.GetProperty("id").GetString();
        }
        finally { signInGate.Release(); }
    }

    public async Task<bool> HasCommandAccessAsync()
    {
        using var req=Request(HttpMethod.Post,"/rest/v1/rpc/is_elevated");
        req.Content=JsonContent.Create(new { u=UserId });
        using var res=await http.SendAsync(req);
        if(!res.IsSuccessStatusCode)return false;
        return bool.TryParse(await res.Content.ReadAsStringAsync(),out var value)&&value;
    }

    public async Task<List<MissionOption>> GetMissionChoicesAsync()
    {
        using var req=Request(HttpMethod.Get,"/rest/v1/missions?select=id,title,start_time&start_time=gte."+Uri.EscapeDataString(DateTimeOffset.UtcNow.ToString("O"))+"&order=start_time.asc");
        using var res=await http.SendAsync(req);res.EnsureSuccessStatusCode();
        using var doc=JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var list=new List<MissionOption>();
        foreach(var m in doc.RootElement.EnumerateArray()){
            var id=m.GetProperty("id").GetString();if(string.IsNullOrWhiteSpace(id))continue;
            var title=m.GetProperty("title").GetString()??"Untitled operation";
            var start=m.TryGetProperty("start_time",out var st)&&st.ValueKind!=JsonValueKind.Null&&DateTimeOffset.TryParse(st.GetString(),out var dt)?dt:DateTimeOffset.Now;
            list.Add(new MissionOption(id,title,start));
        }
        return list;
    }

    public async Task SetActiveOperationAsync(string? missionId)
    {
        using var req=Request(HttpMethod.Post,"/rest/v1/rpc/command_set_active_overlay_operation");
        req.Content=JsonContent.Create(new { p_mission_id=missionId });
        using var res=await http.SendAsync(req);res.EnsureSuccessStatusCode();
    }

    public async Task AssignStationAsync(string missionId,string userId,string? station)
    {
        using var req=Request(HttpMethod.Post,"/rest/v1/rpc/command_assign_mission_station");
        req.Content=JsonContent.Create(new { p_mission_id=missionId, p_user_id=userId, p_station=station });
        using var res=await http.SendAsync(req);res.EnsureSuccessStatusCode();
    }

    HttpRequestMessage Request(HttpMethod method,string path){var r=new HttpRequestMessage(method,SupabaseConfig.Url+path);r.Headers.Add("apikey",SupabaseConfig.ApiKey);r.Headers.Authorization=new AuthenticationHeaderValue("Bearer",accessToken);return r;}

    public async Task<MissionOption?> GetActiveMissionAsync()
    {
        using var stateReq=Request(HttpMethod.Get,"/rest/v1/overlay_operation_state?select=mission_id&singleton=eq.true");using var stateRes=await http.SendAsync(stateReq);stateRes.EnsureSuccessStatusCode();
        using var stateDoc=JsonDocument.Parse(await stateRes.Content.ReadAsStringAsync());var row=stateDoc.RootElement.EnumerateArray().FirstOrDefault();
        if(row.ValueKind==JsonValueKind.Undefined||!row.TryGetProperty("mission_id",out var mid)||mid.ValueKind==JsonValueKind.Null)return null;var id=mid.GetString();if(string.IsNullOrWhiteSpace(id))return null;
        using var req=Request(HttpMethod.Get,"/rest/v1/missions?select=id,title,start_time&id=eq."+Uri.EscapeDataString(id));using var res=await http.SendAsync(req);res.EnsureSuccessStatusCode();
        using var doc=JsonDocument.Parse(await res.Content.ReadAsStringAsync());var mission=doc.RootElement.EnumerateArray().FirstOrDefault();if(mission.ValueKind==JsonValueKind.Undefined)return null;
        var title=mission.TryGetProperty("title",out var t)?t.GetString()??"Untitled operation":"Untitled operation";var start=mission.TryGetProperty("start_time",out var st)&&st.ValueKind!=JsonValueKind.Null&&DateTimeOffset.TryParse(st.GetString(),out var dt)?dt:DateTimeOffset.Now;
        return new MissionOption(id,title,start);
    }

    public async Task<List<CrewAssignment>> GetCrewAsync(string missionId)
    {
        using var req=Request(HttpMethod.Get,"/rest/v1/mission_signups?select=user_id,status,operational_role,operational_station,overlay_readiness&mission_id=eq."+Uri.EscapeDataString(missionId));
        using var res=await http.SendAsync(req);res.EnsureSuccessStatusCode();using var doc=JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var rows=doc.RootElement.EnumerateArray().Where(x=>x.TryGetProperty("status",out var status)&&status.ValueKind!=JsonValueKind.Null&&string.Equals(status.GetString()?.Trim(),"going",StringComparison.OrdinalIgnoreCase)).ToList();
        var ids=rows.Select(x=>x.GetProperty("user_id").GetString()).Where(x=>!string.IsNullOrWhiteSpace(x)).Distinct().ToList();var names=new Dictionary<string,string>();
        if(ids.Count>0){using var p=Request(HttpMethod.Get,"/rest/v1/profiles?select=user_id,display_name,handle&user_id=in.("+string.Join(",",ids)+")");using var pr=await http.SendAsync(p);pr.EnsureSuccessStatusCode();using var pd=JsonDocument.Parse(await pr.Content.ReadAsStringAsync());
          foreach(var x in pd.RootElement.EnumerateArray()){var id=x.GetProperty("user_id").GetString()!;var handle=x.TryGetProperty("handle",out var h)&&h.ValueKind!=JsonValueKind.Null?h.GetString():null;var display=x.TryGetProperty("display_name",out var d)&&d.ValueKind!=JsonValueKind.Null?d.GetString():null;var name=!string.IsNullOrWhiteSpace(handle)?handle:display;if(!string.IsNullOrWhiteSpace(name)&&name.Contains('@'))name=name.Split('@')[0];names[id]=name??"CREW";}}
        return rows.Select(x=>{var id=x.GetProperty("user_id").GetString()!;string? Get(string n)=>x.TryGetProperty(n,out var v)&&v.ValueKind!=JsonValueKind.Null?v.GetString():null;return new CrewAssignment(id,names.GetValueOrDefault(id,"CREW"),Get("operational_station"),Get("operational_role"),Get("overlay_readiness")??"assigned");}).ToList();
    }

    public async Task SetReadinessAsync(string missionId,string readiness){using var req=Request(HttpMethod.Post,"/rest/v1/rpc/set_my_overlay_readiness");req.Content=JsonContent.Create(new{p_mission_id=missionId,p_readiness=readiness});using var res=await http.SendAsync(req);res.EnsureSuccessStatusCode();}
}
