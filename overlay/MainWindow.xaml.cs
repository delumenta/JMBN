using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Shapes;

namespace JMBNOverlay;

public partial class MainWindow : Window
{
    const int HOTKEY_ID=9001, WM_HOTKEY=0x0312, MOD_ALT=0x0001, VK_J=0x4A;
    const int GWL_EXSTYLE=-20, WS_EX_TRANSPARENT=0x20, WS_EX_LAYERED=0x80000;
    bool clickThrough=false;
    readonly Station[] stations = [
      new("AIR",21.2,77.9), new("HELMSMAN",12.4,87.0), new("SURFACE",16.9,71.7),
      new("OOD",10.4,79.0), new("COMMAND CHAIR",14.0,77.4), new("ENGINEER",71.5,40.2),
      new("TORPEDO DIRECTOR",35.3,72.4), new("MOUNT 3-1",78.8,61.2),
      new("MOUNT 3-2",45.7,37.0), new("MOUNT 4-1",50.6,54.7),
      new("MOUNT 4-2",38.3,46.8), new("MOUNT 6-1",29.7,88.5)
    ];

    public MainWindow()
    {
      InitializeComponent();
      Loaded += (_,__) => { DrawMarkers(); RegisterOverlayHotkey(); };
      SizeChanged += (_,__) => DrawMarkers();
      PreviewKeyDown += OnKeyDown;
    }

    void DrawMarkers()
    {
      MarkerCanvas.Children.Clear();
      var w=MapRoot.ActualWidth; var h=MapRoot.ActualHeight;
      if(w<=0||h<=0)return;
      foreach(var s in stations) {
        var dot=new Ellipse{Width=9,Height=9,Fill=new SolidColorBrush(Color.FromRgb(215,182,106))};
        Canvas.SetLeft(dot,w*s.X/100-4.5); Canvas.SetTop(dot,h*s.Y/100-4.5); MarkerCanvas.Children.Add(dot);
        var label=new TextBlock{Text=s.Name,Foreground=new SolidColorBrush(Color.FromRgb(215,182,106)),FontSize=10,FontWeight=FontWeights.Bold,FontFamily=new FontFamily("Play"),Background=new SolidColorBrush(Color.FromArgb(150,5,7,5))};
        Canvas.SetLeft(label,w*s.X/100+7); Canvas.SetTop(label,h*s.Y/100-7); MarkerCanvas.Children.Add(label);
      }
    }

    void RegisterOverlayHotkey()
    {
      var helper=new WindowInteropHelper(this);
      var source=HwndSource.FromHwnd(helper.Handle); source?.AddHook(WndProc);
      RegisterHotKey(helper.Handle,HOTKEY_ID,MOD_ALT,VK_J);
    }

    IntPtr WndProc(IntPtr hwnd,int msg,IntPtr wParam,IntPtr lParam,ref bool handled)
    {
      if(msg==WM_HOTKEY && wParam.ToInt32()==HOTKEY_ID){ Visibility=Visibility==Visibility.Visible?Visibility.Hidden:Visibility.Visible; handled=true; }
      return IntPtr.Zero;
    }

    void OnKeyDown(object sender,KeyEventArgs e){ if(e.Key==Key.F8){clickThrough=!clickThrough; SetClickThrough(clickThrough); StatusText.Text=clickThrough?"CLICK-THROUGH":"LOCAL PREVIEW";} }
    void SetClickThrough(bool enabled){var h=new WindowInteropHelper(this).Handle;var ex=GetWindowLong(h,GWL_EXSTYLE);SetWindowLong(h,GWL_EXSTYLE,enabled?(ex|WS_EX_TRANSPARENT|WS_EX_LAYERED):(ex&~WS_EX_TRANSPARENT));}
    void CloseButton_Click(object sender,RoutedEventArgs e)=>Close();
    protected override void OnClosed(EventArgs e){var h=new WindowInteropHelper(this).Handle;UnregisterHotKey(h,HOTKEY_ID);base.OnClosed(e);}
    record Station(string Name,double X,double Y);

    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr hWnd,int id,int fsModifiers,int vk);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hWnd,int id);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr hWnd,int nIndex);
    [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr hWnd,int nIndex,int dwNewLong);
}