export class TaskNode extends Promise<void> {
    addProgress?: () => void;
    done = -1;
    all = 0;
    constructor(childs_: Promise<Promise<void>[]> | Promise<void>[]) {
        super(async (resolve, reject) => {
            if (this.addProgress)
                this.addProgress();
            const childs = await childs_;
            this.done++;
            this.all = childs.length;
            for (const child of childs) {
                if(child instanceof TaskNode) {
                    this.all--;
                    this.all += child.all;
                    child.onAddProgress(this.addProgress);
                } else {
                    child.then(() => {
                        if (this.addProgress)
                            this.addProgress();
                        this.done++;
                        if(this.done === this.all)resolve();
                    });
                    child.catch(reject);
                }
            }
        });
    }
    onAddProgress(addProgress?: () => void) {
        this.addProgress = addProgress;
    }
}
