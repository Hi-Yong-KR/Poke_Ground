// 화면 객체 수집: 보이는 최상위 창(EnumWindows)과 바탕화면 아이콘(SysListView32 원격 조회)
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class PokeScan {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
    delegate bool EnumProc(IntPtr h, IntPtr p);

    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr p);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr v);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string c, string n);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string n);
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint a, bool i, uint pid);
    [DllImport("kernel32.dll")] static extern IntPtr VirtualAllocEx(IntPtr p, IntPtr a, uint s, uint t, uint pr);
    [DllImport("kernel32.dll")] static extern bool VirtualFreeEx(IntPtr p, IntPtr a, uint s, uint t);
    [DllImport("kernel32.dll")] static extern bool ReadProcessMemory(IntPtr p, IntPtr a, byte[] b, int s, out IntPtr r);
    [DllImport("kernel32.dll")] static extern bool WriteProcessMemory(IntPtr p, IntPtr a, byte[] b, int s, out IntPtr r);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);

    public static void InitDpi() {
        try { if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return; } catch {}
        try { SetProcessDPIAware(); } catch {}
    }

    public class Win { public string title, cls; public uint pid; public long hwnd; public int x, y, w, h, z; }
    public class Icon { public string name; public int x, y, w, h; }

    public static List<Win> Windows() {
        var list = new List<Win>();
        int z = 0;
        EnumWindows((h, p) => {
            if (!IsWindowVisible(h) || IsIconic(h)) return true;
            if (GetWindow(h, 4) != IntPtr.Zero) return true;               // GW_OWNER: 소유된 팝업 제외
            if ((GetWindowLong(h, -20) & 0x80) != 0) return true;           // WS_EX_TOOLWINDOW 제외
            int cloaked;
            if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
            var sb = new StringBuilder(512); GetWindowText(h, sb, 512);
            if (sb.Length == 0) return true;
            var cb = new StringBuilder(256); GetClassName(h, cb, 256);
            RECT r;
            if (DwmGetWindowAttribute(h, 9, out r, Marshal.SizeOf(typeof(RECT))) != 0) return true;
            if (r.R - r.L < 60 || r.B - r.T < 40) return true;
            uint pid; GetWindowThreadProcessId(h, out pid);
            list.Add(new Win { title = sb.ToString(), cls = cb.ToString(), pid = pid, hwnd = h.ToInt64(),
                               x = r.L, y = r.T, w = r.R - r.L, h = r.B - r.T, z = z++ });
            return true;
        }, IntPtr.Zero);
        return list;
    }

    static IntPtr FindDesktopListView() {
        IntPtr def = FindWindowEx(FindWindow("Progman", null), IntPtr.Zero, "SHELLDLL_DefView", null);
        if (def == IntPtr.Zero) {
            EnumWindows((h, p) => {
                IntPtr d = FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null);
                if (d != IntPtr.Zero) { def = d; return false; }
                return true;
            }, IntPtr.Zero);
        }
        return def == IntPtr.Zero ? IntPtr.Zero : FindWindowEx(def, IntPtr.Zero, "SysListView32", null);
    }

    public static List<Icon> Icons() {
        var list = new List<Icon>();
        IntPtr lv = FindDesktopListView();
        if (lv == IntPtr.Zero || !IsWindowVisible(lv)) return list;   // 바탕화면 아이콘 숨김 상태
        int count = SendMessage(lv, 0x1004, IntPtr.Zero, IntPtr.Zero).ToInt32();   // LVM_GETITEMCOUNT
        uint pid; GetWindowThreadProcessId(lv, out pid);
        IntPtr proc = OpenProcess(0x0008 | 0x0010 | 0x0020, false, pid);
        if (proc == IntPtr.Zero) return list;
        const int TEXT = 520, ITEM = 88;   // ITEM: x64 LVITEMW 크기
        IntPtr mem = VirtualAllocEx(proc, IntPtr.Zero, 4096, 0x1000 | 0x2000, 0x04);
        try {
            IntPtr itemPtr = new IntPtr(mem.ToInt64() + 256);
            IntPtr textPtr = new IntPtr(mem.ToInt64() + 1024);
            IntPtr rw;
            for (int i = 0; i < count; i++) {
                byte[] rc = new byte[16];   // left = LVIR_BOUNDS(0)
                WriteProcessMemory(proc, mem, rc, 16, out rw);
                SendMessage(lv, 0x100E, new IntPtr(i), mem);                // LVM_GETITEMRECT
                ReadProcessMemory(proc, mem, rc, 16, out rw);
                POINT tl = new POINT { X = BitConverter.ToInt32(rc, 0), Y = BitConverter.ToInt32(rc, 4) };
                int w = BitConverter.ToInt32(rc, 8) - tl.X, h = BitConverter.ToInt32(rc, 12) - tl.Y;
                ClientToScreen(lv, ref tl);

                byte[] item = new byte[ITEM];
                BitConverter.GetBytes(textPtr.ToInt64()).CopyTo(item, 24); // pszText
                BitConverter.GetBytes(TEXT / 2).CopyTo(item, 32);          // cchTextMax
                WriteProcessMemory(proc, itemPtr, item, ITEM, out rw);
                int len = SendMessage(lv, 0x1073, new IntPtr(i), itemPtr).ToInt32();   // LVM_GETITEMTEXTW
                byte[] txt = new byte[TEXT];
                ReadProcessMemory(proc, textPtr, txt, TEXT, out rw);
                string name = Encoding.Unicode.GetString(txt, 0, Math.Max(0, Math.Min(len, TEXT / 2)) * 2);
                list.Add(new Icon { name = name, x = tl.X, y = tl.Y, w = w, h = h });
            }
        } finally {
            VirtualFreeEx(proc, mem, 0, 0x8000);
            CloseHandle(proc);
        }
        return list;
    }
}
