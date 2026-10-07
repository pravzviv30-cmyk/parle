/** Reserved capacity follows the child lifetime, not the decode promise. */
export interface DecoderReservation { release(): void }
export class AudioDecoderSlots {
  private active = 0;
  private guests = 0;
  private reservations = new WeakMap<DecoderReservation, { guest: boolean; state: 'held' | 'claimed' | 'released' }>();
  reserve(guest: boolean): DecoderReservation | null {
    if (this.active >= 2 || (guest && this.guests >= 1)) return null;
    this.active++;
    if (guest) this.guests++;
    const entry = { guest, state: 'held' as 'held' | 'claimed' | 'released' };
    const reservation = { release: () => { if (entry.state === 'held') this.finish(entry); } };
    this.reservations.set(reservation, entry);
    return reservation;
  }
  claim(reservation: DecoderReservation): (() => void) | null {
    const entry = this.reservations.get(reservation);
    if (!entry || entry.state !== 'held') return null;
    entry.state = 'claimed';
    return () => this.finish(entry);
  }
  private finish(entry: { guest: boolean; state: string }): void {
    if (entry.state === 'released') return;
    entry.state = 'released';
    this.active--;
    if (entry.guest) this.guests--;
  }
}
