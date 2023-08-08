export function transformJSON(source: string): string {
    const result = [];
    let isStr = 0;
    for(const i of source) {
        switch (i) {
            case '"':
                if (isStr == 1) isStr = 0;
                else if (isStr == 0) isStr = 1;
                result.push(i);
                break;
            case "'":
                if (isStr == 2) isStr = 0;
                else if (isStr == 0) isStr = 2;
                result.push(i);
                break;

            case '\n':
                if (isStr) {
                    result.push("\\n");
                    break;
                }

            default:
                result.push(i);
                break;
        }
    }
    return result.join("");
}