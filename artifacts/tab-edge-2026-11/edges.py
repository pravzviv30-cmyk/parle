# lldb script: print every UIScrollView in the key window with its top edge effect state.
import lldb


def ev(frame, expr):
    opts = lldb.SBExpressionOptions()
    opts.SetLanguage(lldb.eLanguageTypeObjC)
    opts.SetTimeoutInMicroSeconds(5_000_000)
    return frame.EvaluateExpression(expr, opts)


def run(debugger, command, result, internal_dict):
    frame = debugger.GetSelectedTarget().GetProcess().GetSelectedThread().GetSelectedFrame()
    ev(frame, '@import UIKit')
    seen = []

    def walk(addr, depth):
        cls = ev(frame, f'(const char *)object_getClassName((id){addr})').GetSummary() or ''
        is_scroll = ev(frame, f'(BOOL)[(id){addr} isKindOfClass:[UIScrollView class]]').GetValueAsUnsigned()
        if is_scroll:
            hidden = ev(frame, f'(BOOL)[[(UIScrollView *){addr} topEdgeEffect] isHidden]').GetValueAsUnsigned()
            frame_s = ev(frame, f'(CGRect)[(UIView *){addr} frame]')
            ox = ev(frame, f'(CGFloat)[(UIScrollView *){addr} contentOffset].y').GetValue()
            win = ev(frame, f'(BOOL)([(UIView *){addr} window] != nil)').GetValueAsUnsigned()
            hid_view = ev(frame, f'(BOOL)[(UIView *){addr} isHidden]').GetValueAsUnsigned()
            w = frame_s.GetChildMemberWithName('size').GetChildMemberWithName('width').GetValue()
            h = frame_s.GetChildMemberWithName('size').GetChildMemberWithName('height').GetValue()
            seen.append(f'{"  " * depth}{cls} {addr} size={w}x{h} offsetY={ox} inWindow={win} viewHidden={hid_view} topEdgeEffectHidden={hidden}')
        n = ev(frame, f'(unsigned long)[[(UIView *){addr} subviews] count]').GetValueAsUnsigned()
        for i in range(n):
            child = ev(frame, f'(unsigned long)[[(UIView *){addr} subviews] objectAtIndex:{i}]').GetValueAsUnsigned()
            walk(hex(child), depth + 1)

    window = ev(frame, '(unsigned long)[[[[UIApplication sharedApplication] connectedScenes] anyObject] keyWindow]').GetValueAsUnsigned()
    if not window:
        window = ev(frame, '(unsigned long)[[[UIApplication sharedApplication] windows] firstObject]').GetValueAsUnsigned()
    walk(hex(window), 0)
    print('\n'.join(seen) if seen else 'no scroll views found')


def __lldb_init_module(debugger, internal_dict):
    debugger.HandleCommand('command script add -f edges.run edges')
