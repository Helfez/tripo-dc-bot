enum LogType {
  ERR="error",
  NORMAL="normal",
  SUCCESS="success",
}

export enum LOG_ACTIONS {
  TEXT_CREATE = 'textCreate',
  IMG_CREATE = 'imageCreate',
  BIND = 'bind',
  SYS = 'system',
  GIVEAWAY = 'giveaway',
  TWITTER = 'twitter',
  DEFAULT = 'unknown',
}

class TLogUtils {
  // log = (content: string, extra?: any) => {
  //   console.log(JSON.stringify({
  //     type: LogType.NORMAL,
  //     content,
  //     extra: extra ? JSON.stringify(extra) : undefined,
  //   }))
  // }

  logBase = (type: LogType = LogType.NORMAL, action: LOG_ACTIONS = LOG_ACTIONS.DEFAULT, content: string, ...args: any) => {
    console.log(JSON.stringify({
      type,
      action,
      content,
      extra: args ? JSON.stringify(args) : undefined,
    }))
  }

  log = (action: LOG_ACTIONS = LOG_ACTIONS.DEFAULT, content: string, ...args: any) => {
    this.logBase(LogType.NORMAL, action, content, ...args)
  }

  logSuccess = (action: LOG_ACTIONS = LOG_ACTIONS.DEFAULT, content: string, ...args: any) => {
    this.logBase(LogType.SUCCESS, action, content, ...args)
  }

  logError = (action: LOG_ACTIONS = LOG_ACTIONS.DEFAULT, content: string, ...args: any) => {
    this.logBase(LogType.ERR, action, content, ...args)
  }

  logWithId = (action: LOG_ACTIONS = LOG_ACTIONS.DEFAULT, content: string, taskId: string, ...args: any) => {
    this.logBase(LogType.NORMAL, action, content, taskId, ...args)
  }

  logWithTraceId = (action: LOG_ACTIONS = LOG_ACTIONS.DEFAULT, traceId: string, info?: any, taskId?: string, ...args: any) => {
    this.logBase(LogType.ERR, action, traceId, info, taskId, ...args)
  }

  // logSuccess = (content: string, extra?: any) => {
  //   console.log(JSON.stringify({
  //     type: LogType.SUCCESS,
  //     content,
  //     extra: extra ? JSON.stringify(extra) : undefined,
  //   }))
  // }
  //
  // logWithId = (content: string, taskId: string ) => {
  //   console.log(JSON.stringify({
  //     type: LogType.NORMAL,
  //     taskId,
  //     content
  //   }));
  // }
  //
  // logWithTraceId = (traceId: string, info?: any, taskId?: string) => {
  //   console.log(JSON.stringify({
  //     type: LogType.ERR,
  //     traceId,
  //     taskId,
  //     info: info ? JSON.stringify(info) : undefined
  //   }));
  // }
  //
  // logError = (content: string, e?: any, taskId?: string) => {
  //   console.log(JSON.stringify({
  //     type: LogType.ERR,
  //     content,
  //     errInfo: e ? JSON.stringify(e) : undefined,
  //     taskId,
  //   }));
  // }
}

const tLog = new TLogUtils();
export default tLog;
