export function __mkLeading (leading: number) {
    return new Array(leading).fill(' ').join('');
}

export function __getDetailStats (stats: string | [string, string]) {
    return Array.isArray(stats) ? stats[1] : stats;
}

export interface __StatsText {
    [x: number]: __StatsText | __StatsText[] | string;
}

export function __makeErrorFormed (): __StatsText {
    return {
        0: '[[error-formed]]',
    };
}

export function __prependToHead (statsText: __StatsText, str: string): __StatsText {
    const first = statsText[0];
    if (typeof first === 'string') {
        statsText[0] = `${str}${first}`;
    } else if (typeof first === 'object') {
        __prependToHead(first, str);
    } else if (typeof first === 'undefined') {
        statsText[0] = str;
    } else {
        __prependToHead(first[0], str);
    }
    return statsText;
}
