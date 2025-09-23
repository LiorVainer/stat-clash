export class Timer {
    private startTime: number;
    private lapTime: number;

    constructor() {
        this.startTime = Date.now();
        this.lapTime = this.startTime;
    }

    lap(): number {
        const now = Date.now();
        const duration = now - this.lapTime;
        this.lapTime = now;
        return duration;
    }

    total(): number {
        return Date.now() - this.startTime;
    }

    reset(): void {
        this.startTime = Date.now();
        this.lapTime = this.startTime;
    }
}
