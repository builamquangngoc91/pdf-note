/** null allows normal scrolling; 0 consumes momentum; +/-1 changes the page. */
export class WheelPager {
  private until = 0;
  private last = 0;
  private amount = 0;
  private direction = 0;

  step(
    delta: number,
    top: number,
    maximum: number,
    page: number,
    pages: number,
    now: number,
  ): -1 | 0 | 1 | null {
    if (!Number.isFinite(delta) || delta === 0) return null;
    if (now < this.until) return 0;
    const direction = delta > 0 ? 1 : -1;
    const atEdge = direction > 0 ? top >= maximum - 2 : top <= 2;
    if (!atEdge || (direction > 0 ? page >= pages : page <= 1)) {
      this.amount = 0;
      return null;
    }
    if (direction !== this.direction || now - this.last > 200) this.amount = 0;
    this.direction = direction;
    this.last = now;
    this.amount += Math.abs(delta);
    if (this.amount < 40) return 0;
    this.amount = 0;
    this.until = now + 650;
    return direction;
  }
}
