import { tutorGate } from '../tutor/gate.ts';

interface ConversationStartPorts {
  scope: () => number;
  visible: () => boolean;
  probe: () => Promise<boolean>;
  checking: (value: boolean) => void;
  failed: (value: boolean) => void;
  open: (screen: 'Convo', params: { textMode?: boolean }) => void;
}

/** One current start per visible screen; an abandoned probe can never reopen it. */
export class ConversationStartRequest {
  private issued = 0;
  private pending = false;

  invalidate(): void {
    this.issued += 1;
    this.pending = false;
  }

  async start(ports: ConversationStartPorts, textMode?: boolean): Promise<void> {
    if (this.pending || !ports.visible()) return;
    const ticket = ++this.issued;
    const owner = ports.scope();
    const current = () => ticket === this.issued && owner === ports.scope() && ports.visible();
    this.pending = true;
    ports.checking(true);
    ports.failed(false);
    try {
      const answer = await ports.probe();
      if (!current()) return;
      const gate = tutorGate(answer, textMode);
      if (gate.go) ports.open(gate.screen, gate.params);
      else ports.failed(true);
    } catch {
      if (current()) ports.failed(true);
    } finally {
      // An older completion must not clear a newer start's busy state.
      if (current()) {
        this.pending = false;
        ports.checking(false);
      }
    }
  }
}
