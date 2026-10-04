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
    internal string? UserId { get; private set; }

    static string B64(byte[] b)=>Convert.ToBase64String(b).TrimEnd('=').Replace('+','-').Replace('/','_');
    static string RandomToken(){var b=new byte[32];RandomNumberGenerator.Fill(b);return B64(b);}

    public async Task SignInWithDiscordAsync()
    {
        const string redirect="http://127.0.0.1:54327/";
        var verifier=RandomToken();
        var challenge=B64(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        var state=RandomToken();
        using var listener=new HttpListener();
        listener.Prefixes.Add(redirect); listener.Start();
        var auth=SupabaseConfig.Url+"/auth/v1/authorize?provider=discord&redirect_to="+Uri.EscapeDataString(redirect)+"&code_challenge="+Uri.EscapeDataString(challenge)+"&code_challenge_method=s256&state="+Uri.EscapeDataString(state);
        Process.Start(new ProcessStartInfo(auth){UseShellExecute=true});
        var ctx=await listener.GetContextAsync();
        var code=ctx.Request.QueryString["code"]; var returnedState=ctx.Request.QueryString["state"];
        var html="<html><body style='background:#080a08;color:#d7b66a;font-family:sans-serif;padding:40px'><h2>JMBN MANIFEST LINKED</h2><p>You can return to the overlay.</p><script>window.close()</script></body></html>";
        var bytes=Encoding.UTF8.GetBytes(html);ctx.Response.ContentType="text/html";ctx.Response.ContentLength64=bytes.Length;await ctx.Response.OutputStream.WriteAsync(bytes);ctx.Response.Close();listener.Stop();
        if(string.IsNullOrWhiteSpace(code)||returnedState!=state)throw new InvalidOperationException("Discord sign-in was not completed.");
        using var req=new HttpRequestMessage(HttpMethod.Post,SupabaseConfig.Url+"/auth/v1/token?grant_type=pkce");
        req.Headers.Add("apikey",SupabaseConfig.ApiKey);req.Content=JsonContent.Create(new{auth_code=code,code_verifier=verifier});
        using var res=await http.SendAsync(req);var body=await res.Content.ReadAsStringAsync();if(!res.IsSuccessStatusCode)throw new InvalidOperationException("Discord session exchange failed.");
        using var doc=JsonDocument.Parse(body);accessToken=doc.RootElement.GetProperty("access_token").GetString();UserId=doc.RootElement.GetProperty("user").GetProperty("id").GetString();
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
        using var req=Request(HttpMethod.Get,"/rest/v1/mission_signups?select=user_id,status,operational_role,operational_station,overlay_readiness&mission_id=eq."+Uri.EscapeDataString(missionId)+"&status=in.(going,maybe)");
        using var res=await http.SendAsync(req);res.EnsureSuccessStatusCode();using var doc=JsonDocument.Parse(await res.Content.ReadAsStringAsync());var rows=doc.RootElement.EnumerateArray().ToList();
        var ids=rows.Select(x=>x.GetProperty("user_id").GetString()).Where(x=>!string.IsNullOrWhiteSpace(x)).Distinct().ToList();var names=new Dictionary<string,string>();
        if(ids.Count>0){using var p=Request(HttpMethod.Get,"/rest/v1/profiles?select=user_id,display_name,handle&user_id=in.("+string.Join(",",ids)+")");using var pr=await http.SendAsync(p);pr.EnsureSuccessStatusCode();using var pd=JsonDocument.Parse(await pr.Content.ReadAsStringAsync());
          foreach(var x in pd.RootElement.EnumerateArray()){var id=x.GetProperty("user_id").GetString()!;var name=x.TryGetProperty("display_name",out var d)&&d.ValueKind!=JsonValueKind.Null?d.GetString():null;if(string.IsNullOrWhiteSpace(name)&&x.TryGetProperty("handle",out var h)&&h.ValueKind!=JsonValueKind.Null)name=h.GetString();names[id]=name??"CREW";}}
        return rows.Select(x=>{var id=x.GetProperty("user_id").GetString()!;string? Get(string n)=>x.TryGetProperty(n,out var v)&&v.ValueKind!=JsonValueKind.Null?v.GetString():null;return new CrewAssignment(id,names.GetValueOrDefault(id,"CREW"),Get("operational_station"),Get("operational_role"),Get("overlay_readiness")??"assigned");}).ToList();
    }

    public async Task SetReadinessAsync(string missionId,string readiness){using var req=Request(HttpMethod.Post,"/rest/v1/rpc/set_my_overlay_readiness");req.Content=JsonContent.Create(new{p_mission_id=missionId,p_readiness=readiness});using var res=await http.SendAsync(req);res.EnsureSuccessStatusCode();}
}
