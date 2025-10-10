export class PhysXObject {
    private static _idCounter = 0;

    readonly id: number;

    constructor () {
        this.id = PhysXObject._idCounter++;
    }
}
