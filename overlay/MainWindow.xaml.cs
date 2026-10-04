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
 bool clickThrough=false; string? activeMission; string readiness="assigned";
 readonly Station[] stations=[
  new("air","AIR",21.2,77.9),new("helmsman","HELMSMAN",12.4,87.0),new("surface","SURFACE",16.9,71.7),
  new("ood","OOD",10.4,79.0),new("command_chair","COMMAND CHAIR",14.0,77.4),new("engineering_duty_officer","ENGINEER",71.5,40.2),
  new("torpedo_director","TORPEDO DIRECTOR",35.3,72.4),new("mount_3_1","MOUNT 3-1",78.8,61.2),new("mount_3_2","MOUNT 3-2",45.7,37.0),
  new("mount_4_1","MOUNT 4-1",50.6,54.7),new("mount_4_2","MOUNT 4-2",38.3,46.8),new("mount_6_1","MOUNT 6-1",29.7,88.5)
 ];
 // Preview data is replaced by Manifest data when live sync is connected.
 readonly CrewMarker[] preview=[new("DELUMENTA","mount_4_1",false),new("KAI","helmsman",false),new("YOU","ood",true)];

 public MainWindow(){
  InitializeComponent();
  MissionPicker.Items.Add("OPERATION IRON WAKE // POLARIS");
  MissionPicker.SelectedIndex=0;
  Loaded+=(_,__)=>{RegisterOverlayHotkey(); DrawMarkers();};
  SizeChanged+=(_,__)=>DrawMarkers();
  PreviewKeyDown+=OnKeyDown;
 }

 void LoadOperation_Click(object sender,RoutedEventArgs e){
  activeMission=MissionPicker.SelectedItem?.ToString()??"POLARIS OPERATION";
  MissionTitle.Text="JMBN // "+activeMission.Split("//")[0].Trim();
  StatusText.Text="POLARIS // ACTIVE";
  LoadPanel.Visibility=Visibility.Collapsed;
  AckButton.IsEnabled=true; SeatButton.IsEnabled=true;
  readiness="assigned"; UpdateReadiness(); DrawMarkers();
 }

 void DrawMarkers(){
  MarkerCanvas.Children.Clear();
  if(ShipImage.Source is not BitmapSource bmp || ShipImage.ActualWidth<=0 || ShipImage.ActualHeight<=0)return;
  var box=GetRenderedImageBox(bmp);
  foreach(var crew in preview){
   var station=stations.FirstOrDefault(s=>s.Id==crew.StationId); if(station is null)continue;
   var x=box.X+box.Width*station.X/100.0; var y=box.Y+box.Height*station.Y/100.0;
   var dot=new Ellipse{Width=crew.IsSelf?14:12,Height=crew.IsSelf?14:12,Stroke=new SolidColorBrush(Color.FromRgb(215,182,106)),StrokeThickness=2,
    Fill=crew.IsSelf?new SolidColorBrush(Color.FromRgb(215,182,106)):Brushes.Transparent};
   if(crew.IsSelf)dot.Effect=new DropShadowEffect{Color=Color.FromRgb(215,182,106),BlurRadius=16,ShadowDepth=0,Opacity=.9};
   Canvas.SetLeft(dot,x-dot.Width/2);Canvas.SetTop(dot,y-dot.Height/2);MarkerCanvas.Children.Add(dot);
   var label=new TextBlock{Text=crew.Name+"\n"+station.Label,Foreground=new SolidColorBrush(crew.IsSelf?Color.FromRgb(255,220,126):Color.FromRgb(215,182,106)),
    FontFamily=new FontFamily("Play"),FontWeight=crew.IsSelf?FontWeights.Bold:FontWeights.Normal,FontSize=crew.IsSelf?11:10,
    Background=new SolidColorBrush(Color.FromArgb(165,5,7,5)),Padding=new Thickness(4,2,4,2)};
   Canvas.SetLeft(label,x+9);Canvas.SetTop(label,y-9);MarkerCanvas.Children.Add(label);
  }
  ManningText.Text=$"{preview.Length} / {stations.Length} STATIONS MANNED";
  var me=preview.FirstOrDefault(x=>x.IsSelf);var mine=me is null?null:stations.FirstOrDefault(s=>s.Id==me.StationId);
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
 void AckButton_Click(object sender,RoutedEventArgs e){readiness="ack";UpdateReadiness();}
 void SeatButton_Click(object sender,RoutedEventArgs e){readiness="seat";UpdateReadiness();}
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
 record CrewMarker(string Name,string StationId,bool IsSelf);
 [DllImport("user32.dll")]static extern bool RegisterHotKey(IntPtr hWnd,int id,int fsModifiers,int vk);
 [DllImport("user32.dll")]static extern bool UnregisterHotKey(IntPtr hWnd,int id);
 [DllImport("user32.dll")]static extern int GetWindowLong(IntPtr hWnd,int nIndex);
 [DllImport("user32.dll")]static extern int SetWindowLong(IntPtr hWnd,int nIndex,int dwNewLong);
}