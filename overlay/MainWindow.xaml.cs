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
  new("command_chair","COMMAND CHAIR",13.3,76.0,4.8,52.8),
  new("icc","INTEGRATED COMMAND CENTRE",25.8,58.0,14.2,46.0),
  new("ood","OFFICER OF THE DECK",9.6,77.5,0.8,67.6),
  new("helmsman","HELMSMAN",11.7,85.5,7.0,91.0),
  new("air","CHIEF OF THE WATCH / “AIR”",20.5,76.0,49.5,82.0),
  new("surface","“SURFACE”",16.2,71.0,16.2,61.0),
  new("engineering_duty_officer","ENGINEERING DUTY OFFICER",71.0,40.0,83.5,39.5),
  new("torpedo_director","TORPEDO DIRECTOR CONSOLE",34.6,71.2,36.0,70.0),
  new("mount_3_1","MOUNT 3-1",78.0,60.2,77.2,66.0),
  new("mount_3_2","MOUNT 3-2",45.0,36.8,42.0,24.5),
  new("mount_4_1","MOUNT 4-1",50.0,54.0,46.5,62.0),
  new("mount_4_2","MOUNT 4-2",37.6,46.5,28.8,43.0),
  new("mount_6_1","MOUNT 6-1",29.0,86.6,27.4,91.5)
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
   if(await data.HasCommandAccessAsync()){CommandPanel.Visibility=Visibility.Visible;CommandTab.Visibility=Visibility.Visible;DrawerCloseButton.Visibility=Visibility.Visible;MissionPicker.ItemsSource=await data.GetMissionChoicesAsync();}
   refreshTimer.Start();
   await RefreshOperationAsync();
  }catch(Exception ex){LoginError.Text=ex.Message;}finally{LoginButton.IsEnabled=true;}
 }

 async Task RefreshOperationAsync(){
  try{
   var latest=await data.GetActiveMissionAsync();
   if(latest is null){
    activeMission=null;crew=[];ActiveOperationText.Text="NO ACTIVE OPERATION";MissionTitle.Text="JMBN // POLARIS";StatusText.Text="STANDING BY";LoadPanel.Visibility=Visibility.Collapsed;AckButton.IsEnabled=false;SeatButton.IsEnabled=false;DrawMarkers();UpdateInfoPanels();return;
   }
   var changed=activeMission?.Id!=latest.Id;activeMission=latest;ActiveOperationText.Text=latest.Title.ToUpperInvariant();MissionTitle.Text="JMBN // "+latest.Title.ToUpperInvariant();if(CommandPanel.Visibility==Visibility.Visible&&changed)LoadPanel.Visibility=Visibility.Collapsed;else if(CommandPanel.Visibility!=Visibility.Visible)LoadPanel.Visibility=Visibility.Collapsed;AckButton.IsEnabled=true;SeatButton.IsEnabled=true;
   await RefreshCrewAsync();
   ReadyRoomOperation.Text="PRE-DEPLOYMENT // "+latest.Title.ToUpperInvariant();
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
  var gold=new SolidColorBrush(Color.FromRgb(215,182,106));
  var white=new SolidColorBrush(Color.FromRgb(232,232,232));
  var dark=new SolidColorBrush(Color.FromArgb(215,5,7,5));
  foreach(var station in stations){
   var member=crew.FirstOrDefault(m=>m.Station==station.Id);
   var ax=box.X+box.Width*station.AnchorX/100.0; var ay=box.Y+box.Height*station.AnchorY/100.0;
   var lx=box.X+box.Width*station.LabelX/100.0; var ly=box.Y+box.Height*station.LabelY/100.0;
   var acknowledged=member is not null&&(member.Readiness=="acknowledged"||member.Readiness=="on_station");
   var isMine=member?.UserId==data.UserId;
   var ring=member is null?white:gold;

   var labelText=member is null?"UNASSIGNED":member.Name.ToUpperInvariant();
   var label=new Border{Background=dark,BorderBrush=gold,BorderThickness=new Thickness(1),CornerRadius=new CornerRadius(2),Padding=new Thickness(6,3,6,3)};
   var stack=new StackPanel();
   stack.Children.Add(new TextBlock{Text=station.Label,Foreground=gold,FontFamily=new FontFamily("Play"),FontWeight=FontWeights.Bold,FontSize=10,TextWrapping=TextWrapping.NoWrap});
   stack.Children.Add(new TextBlock{Text=labelText,Foreground=member is null?new SolidColorBrush(Color.FromRgb(145,166,139)):Brushes.White,FontFamily=new FontFamily("Play"),FontSize=9,Margin=new Thickness(0,1,0,0),TextWrapping=TextWrapping.NoWrap});
   label.BorderBrush=ring;
   label.Child=stack;
   label.Measure(new Size(double.PositiveInfinity,double.PositiveInfinity));
   var labelW=label.DesiredSize.Width; var labelH=label.DesiredSize.Height;
   var labelCenterX=lx+labelW/2; var labelCenterY=ly+labelH/2;

   var line=new Line{X1=ax,Y1=ay,X2=labelCenterX,Y2=labelCenterY,Stroke=ring,StrokeThickness=1.6};
   MarkerCanvas.Children.Add(line);

   if(isMine){
    var glowRing=new Ellipse{Width=27,Height=27,Stroke=gold,StrokeThickness=2,Fill=Brushes.Transparent,Effect=new DropShadowEffect{Color=Color.FromRgb(255,194,58),BlurRadius=18,ShadowDepth=0,Opacity=.95}};
    Canvas.SetLeft(glowRing,ax-13.5);Canvas.SetTop(glowRing,ay-13.5);MarkerCanvas.Children.Add(glowRing);
   }
   var dot=new Ellipse{Width=17,Height=17,Stroke=ring,StrokeThickness=2.2,Fill=acknowledged?gold:new SolidColorBrush(Color.FromArgb(225,5,7,5))};
   Canvas.SetLeft(dot,ax-8.5);Canvas.SetTop(dot,ay-8.5);MarkerCanvas.Children.Add(dot);

   Canvas.SetLeft(label,lx);Canvas.SetTop(label,ly);MarkerCanvas.Children.Add(label);
  }
  var me=crew.FirstOrDefault(x=>x.UserId==data.UserId);var mine=me is null?null:stations.FirstOrDefault(s=>s.Id==me.Station);
  AssignmentText.Text=mine is null?"NOT ASSIGNED":mine.Label+(string.IsNullOrWhiteSpace(me?.Role)?"":" · "+me.Role!.ToUpperInvariant());
  ReadyRoomAssignment.Text=AssignmentText.Text;
  ReadyRoomCrew.Text=$"{crew.Count} CREW CONNECTED";
  UpdateInfoPanels();if(CrewPanel.Visibility==Visibility.Visible)BuildCrewPanel();
 }

 Rect GetRenderedImageBox(BitmapSource bmp){
  var hostW=MapRoot.ActualWidth;var hostH=MapRoot.ActualHeight;
  var imageRatio=(double)bmp.PixelWidth/bmp.PixelHeight;var hostRatio=hostW/hostH;
  double w,h,left,top;
  if(hostRatio>imageRatio){h=hostH;w=h*imageRatio;left=(hostW-w)/2;top=0;}
  else{w=hostW;h=w/imageRatio;left=0;top=(hostH-h)/2;}
  return new Rect(left,top,w,h);
 }

 void ReadyRoomTab_Click(object sender,RoutedEventArgs e){
  InfoPanel.Visibility=Visibility.Collapsed;LoadPanel.Visibility=Visibility.Collapsed;ReadyRoomPanel.Visibility=Visibility.Visible;
 }
 void PreflightCheck_Changed(object sender,RoutedEventArgs e){
  if(DeploymentReadyButton is null)return;
  DeploymentReadyButton.IsEnabled=LoadoutCheck.IsChecked==true&&BioCheck.IsChecked==true&&CommsCheck.IsChecked==true&&MedbayCheck.IsChecked==true&&activeMission is not null;
 }
 async void DeploymentReadyButton_Click(object sender,RoutedEventArgs e){
  if(activeMission is null||!DeploymentReadyButton.IsEnabled)return;
  try{
   await data.SetReadinessAsync(activeMission.Id,"acknowledged");
   readiness="acknowledged";UpdateReadiness();await RefreshCrewAsync();
   DeploymentReadyButton.Content="READY // DEPLOYMENT CONFIRMED";DeploymentReadyButton.IsEnabled=false;
  }catch(Exception ex){LoginError.Text=ex.Message;}
 }
 void OverviewTab_Click(object sender,RoutedEventArgs e){
  ReadyRoomPanel.Visibility=Visibility.Collapsed;
  LoadPanel.Visibility=Visibility.Collapsed;
  InfoPanelTitle.Text="OVERVIEW";OverviewPanel.Visibility=Visibility.Visible;CrewPanel.Visibility=Visibility.Collapsed;
  UpdateInfoPanels();InfoPanel.Visibility=Visibility.Visible;
 }
 void CrewTab_Click(object sender,RoutedEventArgs e){
  ReadyRoomPanel.Visibility=Visibility.Collapsed;LoadPanel.Visibility=Visibility.Collapsed;
  InfoPanelTitle.Text="POLARIS CREW";OverviewPanel.Visibility=Visibility.Collapsed;CrewPanel.Visibility=Visibility.Visible;
  BuildCrewPanel();InfoPanel.Visibility=Visibility.Visible;
 }
 void InfoClose_Click(object sender,RoutedEventArgs e)=>InfoPanel.Visibility=Visibility.Collapsed;
 void CommandTab_Click(object sender,RoutedEventArgs e){
  if(CommandPanel.Visibility!=Visibility.Visible)return;
  ReadyRoomPanel.Visibility=Visibility.Collapsed;
  InfoPanel.Visibility=Visibility.Collapsed;
  LoadPanel.Visibility=LoadPanel.Visibility==Visibility.Visible?Visibility.Collapsed:Visibility.Visible;
 }
 void UpdateInfoPanels(){
  OverviewOperation.Text=activeMission?.Title.ToUpperInvariant()??"NO ACTIVE OPERATION";
  var manned=crew.Count(x=>!string.IsNullOrWhiteSpace(x.Station));
  OverviewCrew.Text=$"{manned} / {stations.Length} STATIONS MANNED";
  var assigned=crew.Count(x=>!string.IsNullOrWhiteSpace(x.Station)&&x.Readiness=="assigned");
  var ack=crew.Count(x=>!string.IsNullOrWhiteSpace(x.Station)&&x.Readiness=="acknowledged");
  var seated=crew.Count(x=>!string.IsNullOrWhiteSpace(x.Station)&&x.Readiness=="on_station");
  OverviewReadiness.Text=$"{assigned} ASSIGNED · {ack} ACKNOWLEDGED · {seated} ON STATION";
  var me=crew.FirstOrDefault(x=>x.UserId==data.UserId);var mine=me is null?null:stations.FirstOrDefault(s=>s.Id==me.Station);
  OverviewAssignment.Text=mine is null?"NOT ASSIGNED":mine.Label+(string.IsNullOrWhiteSpace(me?.Role)?"":"\n"+me.Role!.ToUpperInvariant());
 }
 void BuildCrewPanel(){
  CrewListPanel.Children.Clear();
  foreach(var station in stations){
   var member=crew.FirstOrDefault(m=>m.Station==station.Id);
   var block=new Border{BorderBrush=new SolidColorBrush(Color.FromRgb(45,42,31)),BorderThickness=new Thickness(0,0,0,1),Padding=new Thickness(0,8,0,8)};
   var stack=new StackPanel();
   stack.Children.Add(new TextBlock{Text=station.Label,Foreground=new SolidColorBrush(Color.FromRgb(215,182,106)),FontFamily=new FontFamily("Play"),FontSize=10,FontWeight=FontWeights.Bold});
   var state=member is null?"UNASSIGNED":member.Readiness=="on_station"?"ON STATION":member.Readiness=="acknowledged"?"ACKNOWLEDGED":"ASSIGNED";
   stack.Children.Add(new TextBlock{Text=(member?.Name.ToUpperInvariant()??"—")+"  //  "+state,Foreground=member is null?new SolidColorBrush(Color.FromRgb(119,125,116)):Brushes.White,FontFamily=new FontFamily("Play"),FontSize=9,Margin=new Thickness(0,3,0,0)});
   block.Child=stack;CrewListPanel.Children.Add(block);
  }
 }
 async void AssignStations_Click(object sender,RoutedEventArgs e){
  if(activeMission is null)return;
  if(StationAssignScroll.Visibility==Visibility.Visible){StationAssignScroll.Visibility=Visibility.Collapsed;return;}
  await RefreshCrewAsync();BuildStationAssignmentPanel();StationAssignScroll.Visibility=Visibility.Visible;
 }
 void BuildStationAssignmentPanel(){
  StationAssignPanel.Children.Clear();
  foreach(var station in stations){
   var row=new Grid{Margin=new Thickness(0,1,0,1)};
   row.ColumnDefinitions.Add(new ColumnDefinition{Width=new GridLength(115)});
   row.ColumnDefinitions.Add(new ColumnDefinition{Width=new GridLength(1,GridUnitType.Star)});
   var label=new TextBlock{Text=station.Label,Foreground=new SolidColorBrush(Color.FromRgb(215,182,106)),FontFamily=new FontFamily("Play"),FontSize=10,VerticalAlignment=VerticalAlignment.Center};
   var picker=new ComboBox{FontFamily=new FontFamily("Play"),Height=24,Tag=station.Id};
   picker.Items.Add(new CrewChoice(null,"— UNASSIGNED —"));
   foreach(var member in crew)picker.Items.Add(new CrewChoice(member.UserId,member.Name.ToUpperInvariant()));
   var current=crew.FirstOrDefault(m=>m.Station==station.Id);
   picker.SelectedItem=picker.Items.Cast<CrewChoice>().FirstOrDefault(i=>i.UserId==current?.UserId)??picker.Items[0];
   picker.SelectionChanged+=StationPicker_Changed;
   Grid.SetColumn(label,0);Grid.SetColumn(picker,1);row.Children.Add(label);row.Children.Add(picker);StationAssignPanel.Children.Add(row);
  }
 }
 async void StationPicker_Changed(object sender,SelectionChangedEventArgs e){
  if(activeMission is null||sender is not ComboBox picker||picker.SelectedItem is not CrewChoice choice)return;
  var station=picker.Tag?.ToString();if(string.IsNullOrWhiteSpace(station))return;
  try{
   var previous=crew.FirstOrDefault(m=>m.Station==station);
   if(choice.UserId is null){if(previous is not null)await data.AssignStationAsync(activeMission.Id,previous.UserId,null);}
   else await data.AssignStationAsync(activeMission.Id,choice.UserId,station);
   await RefreshCrewAsync();BuildStationAssignmentPanel();
  }catch(Exception ex){LoginError.Text=ex.Message;await RefreshCrewAsync();BuildStationAssignmentPanel();}
 }
 record CrewChoice(string? UserId,string Name){public override string ToString()=>Name;}

 async void LoadMission_Click(object sender,RoutedEventArgs e){
  if(MissionPicker.SelectedItem is not MissionOption mission)return;
  try{await data.SetActiveOperationAsync(mission.Id);await RefreshOperationAsync();}catch(Exception ex){LoginError.Text=ex.Message;}
 }
 async void EndMission_Click(object sender,RoutedEventArgs e){
  try{await data.SetActiveOperationAsync(null);await RefreshOperationAsync();}catch(Exception ex){LoginError.Text=ex.Message;}
 }
 void ShipImage_SizeChanged(object sender,SizeChangedEventArgs e)=>DrawMarkers();
 async void AckButton_Click(object sender,RoutedEventArgs e){if(activeMission is null)return;await data.SetReadinessAsync(activeMission.Id,"acknowledged");readiness="acknowledged";UpdateReadiness();await RefreshCrewAsync();}
 async void SeatButton_Click(object sender,RoutedEventArgs e){if(activeMission is null)return;await data.SetReadinessAsync(activeMission.Id,"on_station");readiness="on_station";UpdateReadiness();await RefreshCrewAsync();}
 void UpdateReadiness(){
  var me=crew.FirstOrDefault(x=>x.UserId==data.UserId);
  var hasStation=me is not null&&!string.IsNullOrWhiteSpace(me.Station);
  var state=me?.Readiness??readiness;
  var gold=new SolidColorBrush(Color.FromRgb(215,182,106));
  var white=new SolidColorBrush(Color.FromRgb(232,232,232));
  PersonalStatusDot.Effect=null;
  PersonalStatusDot.Fill=Brushes.Transparent;
  PersonalStatusDot.Stroke=hasStation?gold:white;
  AckButton.Visibility=Visibility.Collapsed;SeatButton.Visibility=Visibility.Collapsed;
  if(!hasStation){
   PersonalStatusText.Text="NOT ASSIGNED";PersonalStatusText.Foreground=white;
   StatusText.Text=activeMission is null?"OPERATION NOT LOADED":"POLARIS // ACTIVE";
   return;
  }
  if(state=="on_station"||state=="seat"){
   PersonalStatusText.Text="ON STATION";PersonalStatusText.Foreground=gold;
   PersonalStatusDot.Fill=gold;PersonalStatusDot.Effect=new DropShadowEffect{Color=Color.FromRgb(255,194,58),BlurRadius=12,ShadowDepth=0,Opacity=.85};
   StatusText.Text="READY // ON STATION";return;
  }
  PersonalStatusDot.Effect=new DropShadowEffect{Color=Color.FromRgb(255,194,58),BlurRadius=12,ShadowDepth=0,Opacity=.85};
  if(state=="acknowledged"||state=="ack"){
   PersonalStatusText.Text="ACKNOWLEDGED";PersonalStatusText.Foreground=gold;
   SeatButton.Visibility=Visibility.Visible;SeatButton.IsEnabled=true;
   StatusText.Text="ASSIGNMENT ACKNOWLEDGED";return;
  }
  PersonalStatusText.Text="ASSIGNED";PersonalStatusText.Foreground=gold;
  AckButton.Content="ACKNOWLEDGE";AckButton.Visibility=Visibility.Visible;AckButton.IsEnabled=true;
  StatusText.Text="POLARIS // ACTIVE";
 }
 void Header_MouseLeftButtonDown(object sender,MouseButtonEventArgs e){if(e.ButtonState==MouseButtonState.Pressed)DragMove();}
 void RegisterOverlayHotkey(){var h=new WindowInteropHelper(this);var src=HwndSource.FromHwnd(h.Handle);src?.AddHook(WndProc);RegisterHotKey(h.Handle,HOTKEY_ID,MOD_ALT,VK_J);}
 IntPtr WndProc(IntPtr hwnd,int msg,IntPtr wParam,IntPtr lParam,ref bool handled){if(msg==WM_HOTKEY&&wParam.ToInt32()==HOTKEY_ID){Visibility=Visibility==Visibility.Visible?Visibility.Hidden:Visibility.Visible;handled=true;}return IntPtr.Zero;}
 void OnKeyDown(object sender,KeyEventArgs e){if(e.Key==Key.F8){clickThrough=!clickThrough;SetClickThrough(clickThrough);StatusText.Text=clickThrough?"CLICK-THROUGH":activeMission is null?"OPERATION NOT LOADED":"POLARIS // ACTIVE";}}
 void SetClickThrough(bool enabled){var h=new WindowInteropHelper(this).Handle;var ex=GetWindowLong(h,GWL_EXSTYLE);SetWindowLong(h,GWL_EXSTYLE,enabled?(ex|WS_EX_TRANSPARENT|WS_EX_LAYERED):(ex&~WS_EX_TRANSPARENT));}
 void CloseButton_Click(object sender,RoutedEventArgs e)=>Close();
 protected override void OnClosed(EventArgs e){var h=new WindowInteropHelper(this).Handle;UnregisterHotKey(h,HOTKEY_ID);base.OnClosed(e);}
 record Station(string Id,string Label,double AnchorX,double AnchorY,double LabelX,double LabelY);
  [DllImport("user32.dll")]static extern bool RegisterHotKey(IntPtr hWnd,int id,int fsModifiers,int vk);
 [DllImport("user32.dll")]static extern bool UnregisterHotKey(IntPtr hWnd,int id);
 [DllImport("user32.dll")]static extern int GetWindowLong(IntPtr hWnd,int nIndex);
 [DllImport("user32.dll")]static extern int SetWindowLong(IntPtr hWnd,int nIndex,int dwNewLong);
}