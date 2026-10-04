using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace JMBNOverlay;

public partial class MainWindow : Window
{
 const int HOTKEY_ID=9001, WM_HOTKEY=0x0312, MOD_ALT=0x0001, VK_J=0x4A;
 const int GWL_EXSTYLE=-20, WS_EX_TRANSPARENT=0x20, WS_EX_LAYERED=0x80000;
 bool clickThrough=false;
    readonly SupabaseService data = new();
    List<CrewAssignment> crew = [];
    MissionOption? activeMission;
    readonly System.Windows.Threading.DispatcherTimer refreshTimer = new(){ Interval = TimeSpan.FromSeconds(8) };
    string readiness="assigned";
 readonly Station[] stations=[
  new("air","AIR",21.2,77.9),new("helmsman","HELMSMAN",12.4,87.0),new("surface","SURFACE",16.9,71.7),
  new("ood","OOD",10.4,79.0),new("command_chair","COMMAND CHAIR",14.0,77.4),new("engineering_duty_officer","ENGINEER",71.5,40.2),
  new("torpedo_director","TORPEDO DIRECTOR",35.3,72.4),new("mount_3_1","MOUNT 3-1",78.8,61.2),new("mount_3_2","MOUNT 3-2",45.7,37.0),
  new("mount_4_1","MOUNT 4-1",50.6,54.7),new("mount_4_2","MOUNT 4-2",38.3,46.8),new("mount_6_1","MOUNT 6-1",29.7,88.5)
 ];

 public MainWindow(){
  InitializeComponent();
  Loaded+=(_,__)=>{RegisterOverlayHotkey(); DrawMarkers(); refreshTimer.Tick += async (_,__) => await RefreshOperationAsync();};
  SizeChanged+=(_,__)=>DrawMarkers();
  PreviewKeyDown+=OnKeyDown;
 }

 async void Login_Click(object sender,RoutedEventArgs e){
  LoginError.Text=""; LoginButton.IsEnabled=false;
  try{
   await data.SignInWithDiscordAsync();
   LoginButton.Visibility=Visibility.Collapsed;
   PanelPrompt.Text="MANIFEST LINKED";MissionPanel.Visibility=Visibility.Visible;StatusText.Text="MANIFEST CONNECTED";
   refreshTimer.Start();
   await RefreshOperationAsync();
  }catch(Exception ex){LoginError.Text=ex.Message;}finally{LoginButton.IsEnabled=true;}
 }

 async Task RefreshOperationAsync(){
  try{
   var latest=await data.GetActiveMissionAsync();
   if(latest is null){
    activeMission=null;crew=[];ActiveOperationText.Text="NO ACTIVE OPERATION";MissionTitle.Text="JMBN // POLARIS";StatusText.Text="STANDING BY";LoadPanel.Visibility=Visibility.Visible;AckButton.IsEnabled=false;SeatButton.IsEnabled=false;DrawMarkers();return;
   }
   activeMission=latest;ActiveOperationText.Text=latest.Title.ToUpperInvariant();MissionTitle.Text="JMBN // "+latest.Title.ToUpperInvariant();LoadPanel.Visibility=Visibility.Collapsed;AckButton.IsEnabled=true;SeatButton.IsEnabled=true;
   await RefreshCrewAsync();
  }catch{StatusText.Text="SYNC RETRYING";}
 }

 async Task RefreshCrewAsync(){
  if(activeMission is null)return;
  try{crew=await data.GetCrewAsync(activeMission.Id);var me=crew.FirstOrDefault(x=>x.UserId==data.UserId);readiness=me?.Readiness??"assigned";UpdateReadiness();DrawMarkers();}catch{StatusText.Text="SYNC RETRYING";}
 }

 void DrawMarkers(){
  MarkerCanvas.Children.Clear();
  if(ShipImage.Source is not BitmapSource bmp || ShipImage.ActualWidth<=0 || ShipImage.ActualHeight<=0)return;
  var box=GetRenderedImageBox(bmp);
  foreach(var station in stations){
   var member=crew.FirstOrDefault(m=>m.Station==station.Id);
   var x=box.X+box.Width*station.X/100.0;var y=box.Y+box.Height*station.Y/100.0;
   var ready=member is not null&&(member.Readiness=="acknowledged"||member.Readiness=="on_station");
   var seated=member?.Readiness=="on_station";var mine=member?.UserId==data.UserId;
   if(seated){var ring=new Ellipse{Width=20,Height=20,Stroke=new SolidColorBrush(Color.FromRgb(215,182,106)),StrokeThickness=1,Fill=Brushes.Transparent};Canvas.SetLeft(ring,x-10);Canvas.SetTop(ring,y-10);MarkerCanvas.Children.Add(ring);}
   var dot=new Ellipse{Width=14,Height=14,Stroke=new SolidColorBrush(Color.FromRgb(215,182,106)),StrokeThickness=2,Fill=ready?new SolidColorBrush(Color.FromRgb(215,182,106)):new SolidColorBrush(Color.FromRgb(5,7,5))};
   if(mine&&ready)dot.Effect=new DropShadowEffect{Color=Color.FromRgb(215,182,106),BlurRadius=16,ShadowDepth=0,Opacity=.9};
   Canvas.SetLeft(dot,x-7);Canvas.SetTop(dot,y-7);MarkerCanvas.Children.Add(dot);
   var label=new TextBlock{Text=member is null?station.Label:station.Label+"\n"+member.Name.ToUpperInvariant(),Foreground=new SolidColorBrush(Color.FromRgb(215,182,106)),FontFamily=new FontFamily("Play"),FontWeight=mine?FontWeights.Bold:FontWeights.Normal,FontSize=10,Background=new SolidColorBrush(Color.FromArgb(150,5,7,5)),Padding=new Thickness(4,2,4,2)};
   Canvas.SetLeft(label,x+10);Canvas.SetTop(label,y-9);MarkerCanvas.Children.Add(label);
  }
  ManningText.Text=$"{crew.Count(x=>!string.IsNullOrWhiteSpace(x.Station))} / {stations.Length} STATIONS MANNED";
  var me=crew.FirstOrDefault(x=>x.UserId==data.UserId);var mine=me is null?null:stations.FirstOrDefault(s=>s.Id==me.Station);
  AssignmentText.Text=mine is null?"YOUR STATION // NOT ASSIGNED":"YOUR STATION // "+mine.Label;
 }

 Rect GetRenderedImageBox(BitmapSource bmp){
  var hostW=MapRoot.ActualWidth;var hostH=MapRoot.ActualHeight;
  var imageRatio=(double)bmp.PixelWidth/bmp.PixelHeight;var hostRatio=hostW/hostH;
  double w,h,left,top;
  if(hostRatio>imageRatio){h=hostH;w=h*imageRatio;left=(hostW-w)/2;top=0;}
  else{w=hostW;h=w/imageRatio;left=0;top=(hostH-h)/2;}
  return new Rect(left,top,w,h);
 }

 void ShipImage_SizeChanged(object sender,SizeChangedEventArgs e)=>DrawMarkers();
 async void AckButton_Click(object sender,RoutedEventArgs e){if(activeMission is null)return;await data.SetReadinessAsync(activeMission.Id,"acknowledged");readiness="ack";UpdateReadiness();await RefreshCrewAsync();}
 async void SeatButton_Click(object sender,RoutedEventArgs e){if(activeMission is null)return;await data.SetReadinessAsync(activeMission.Id,"on_station");readiness="seat";UpdateReadiness();await RefreshCrewAsync();}
 void UpdateReadiness(){
  AckButton.Content=readiness=="assigned"?"ACKNOWLEDGE":"✓ ACKNOWLEDGED";
  SeatButton.Content=readiness=="seat"?"● ON STATION":"ON STATION";
  StatusText.Text=readiness=="seat"?"READY // ON STATION":readiness=="ack"?"ASSIGNMENT ACKNOWLEDGED":"POLARIS // ACTIVE";
 }
 void Header_MouseLeftButtonDown(object sender,MouseButtonEventArgs e){if(e.ButtonState==MouseButtonState.Pressed)DragMove();}
 void RegisterOverlayHotkey(){var h=new WindowInteropHelper(this);var src=HwndSource.FromHwnd(h.Handle);src?.AddHook(WndProc);RegisterHotKey(h.Handle,HOTKEY_ID,MOD_ALT,VK_J);}
 IntPtr WndProc(IntPtr hwnd,int msg,IntPtr wParam,IntPtr lParam,ref bool handled){if(msg==WM_HOTKEY&&wParam.ToInt32()==HOTKEY_ID){Visibility=Visibility==Visibility.Visible?Visibility.Hidden:Visibility.Visible;handled=true;}return IntPtr.Zero;}
 void OnKeyDown(object sender,KeyEventArgs e){if(e.Key==Key.F8){clickThrough=!clickThrough;SetClickThrough(clickThrough);StatusText.Text=clickThrough?"CLICK-THROUGH":activeMission is null?"OPERATION NOT LOADED":"POLARIS // ACTIVE";}}
 void SetClickThrough(bool enabled){var h=new WindowInteropHelper(this).Handle;var ex=GetWindowLong(h,GWL_EXSTYLE);SetWindowLong(h,GWL_EXSTYLE,enabled?(ex|WS_EX_TRANSPARENT|WS_EX_LAYERED):(ex&~WS_EX_TRANSPARENT));}
 void CloseButton_Click(object sender,RoutedEventArgs e)=>Close();
 protected override void OnClosed(EventArgs e){var h=new WindowInteropHelper(this).Handle;UnregisterHotKey(h,HOTKEY_ID);base.OnClosed(e);}
 record Station(string Id,string Label,double X,double Y);
  [DllImport("user32.dll")]static extern bool RegisterHotKey(IntPtr hWnd,int id,int fsModifiers,int vk);
 [DllImport("user32.dll")]static extern bool UnregisterHotKey(IntPtr hWnd,int id);
 [DllImport("user32.dll")]static extern int GetWindowLong(IntPtr hWnd,int nIndex);
 [DllImport("user32.dll")]static extern int SetWindowLong(IntPtr hWnd,int nIndex,int dwNewLong);
}