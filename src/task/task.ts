export class TaskNode extends Promise<void> {
    addProgress?: () => void;
    done = -1;
    all = 0;
    static of(childs_: Promise<Promise<void>[]> | Promise<void>[]): TaskNode {
        const obj = new this(async (resolve, reject) => {
            const childs = await childs_;
            if(!(childs instanceof Array))return;
            if (obj.addProgress)
                obj.addProgress();
            obj.done++;
            obj.all = childs.length;
            for (const child of childs) {
                if(child instanceof TaskNode) {
                    obj.all--;
                    obj.all += child.all;
                    child.onAddProgress(obj.addProgress);
                } else {
                    child.then(() => {
                        if (obj.addProgress)
                            obj.addProgress();
                        obj.done++;
                        if(obj.done === obj.all)resolve();
                    });
                    child.catch(reject);
                }
            }
        });
        return obj;
    }
    private constructor(executor: (resolve: (value: void | PromiseLike<void>) => void, reject: (reason?: unknown) => void) => void) {
        super(executor);
    }
    onAddProgress(addProgress?: () => void) {
        this.addProgress = addProgress;
    }
}
