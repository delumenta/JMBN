using System.Threading;
using System.Windows;
namespace JMBNOverlay;
public partial class App : Application
{
    Mutex? singleInstanceMutex;
    protected override void OnStartup(StartupEventArgs e)
    {
        singleInstanceMutex = new Mutex(true, @"Local\JMBNManifestCompanion", out var createdNew);
        if (!createdNew)
        {
            MessageBox.Show("JMBN Companion is already running. Close the existing window before opening another copy.", "JMBN Companion", MessageBoxButton.OK, MessageBoxImage.Information);
            Shutdown(); return;
        }
        base.OnStartup(e);
    }
    protected override void OnExit(ExitEventArgs e)
    {
        try { singleInstanceMutex?.ReleaseMutex(); } catch (ApplicationException) { }
        singleInstanceMutex?.Dispose(); base.OnExit(e);
    }
}