export function transformJSON(source: string): string {
    const result = [];
    let isStr = false;
    for(const i of source) {
        switch (i) {
            case '"':
            case "'":
                isStr = !isStr;
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