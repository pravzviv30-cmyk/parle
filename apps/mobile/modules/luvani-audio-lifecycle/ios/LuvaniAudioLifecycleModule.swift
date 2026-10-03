import AVFoundation
import ExpoModulesCore

/** No audio capture. A terminal signal for the already-authorized live room. */
public class LuvaniAudioLifecycleModule: Module {
  private var observers: [NSObjectProtocol] = []
  private var interrupted = false
  private var interruptionEpoch: Double = 0
  private let lock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("LuvaniAudioLifecycle")
    Events("onInterruption")
    OnCreate {
      self.observers.append(NotificationCenter.default.addObserver(
        forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
      ) { [weak self] note in
        guard let self,
              let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        self.lock.lock()
        self.interrupted = type == .began
        if type == .began { self.interruptionEpoch += 1 }
        self.lock.unlock()
        if type == .began { self.sendEvent("onInterruption", [:]) }
      })
      self.observers.append(NotificationCenter.default.addObserver(
        forName: AVAudioSession.mediaServicesWereLostNotification, object: nil, queue: .main
      ) { [weak self] _ in
        guard let self else { return }
        self.lock.lock(); self.interrupted = true; self.interruptionEpoch += 1; self.lock.unlock()
        self.sendEvent("onInterruption", [:])
      })
      self.observers.append(NotificationCenter.default.addObserver(
        forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main
      ) { [weak self] _ in
        guard let self else { return }
        self.lock.lock(); self.interrupted = false; self.lock.unlock()
      })
    }
    Function("epoch") { () -> Double in
      self.lock.lock(); defer { self.lock.unlock() }
      return self.interruptionEpoch
    }
    Function("ready") { () -> Bool in
      self.lock.lock(); defer { self.lock.unlock() }
      return !self.interrupted && self.observers.count == 3
    }
    OnDestroy {
      self.observers.forEach { NotificationCenter.default.removeObserver($0) }
      self.observers.removeAll()
    }
  }
}
