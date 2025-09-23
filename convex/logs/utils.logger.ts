'use node';

import winston from 'winston';

export const injectRequestContextFormat = winston.format((info) => {
    const context = {};
    info.meta = {
        ...(info.meta || {}),
        ...context,
    };
    return info;
});
