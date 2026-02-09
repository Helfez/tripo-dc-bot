import {Urls} from "./urls";
import tRequest from "./config";
import {ResponseProtocol} from "../models/protocol";
import {TaskStatus} from "../models/enums";
import {Model} from "../models/task";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

export async function createNewTask(params: Model.CreateTextReq) {
  return tRequest.instance.post<ResponseProtocol.TaskCreateResp>(Urls.task.create, params);
}

export async function getTaskInfo(taskId: string) {
  return tRequest.instance.get<ResponseProtocol.TaskResp>(Urls.task.info + `/${taskId}`);
}

export async function uploadImage(imgBytes: Uint8Array, imageFormat: string) {
  const formData = new FormData();
  formData.append('file', new Blob([imgBytes], { type: `image/${imageFormat}` }), `discord.${imageFormat}`);

  return tRequest.instance.post<ResponseProtocol.ImgUploadResp>(Urls.task.upload, formData);
}


interface CreateTaskWithCallbackParams {
  reqData: Model.CreateTextReq,
  timeOut: number, // 超时秒数
  onFailed: (event: any) => void,
  onProgress: (progress: number, status: string, taskId: string) => void,
  onSuccess: (data: Model.TaskInfo) => void,
  onError: (err: any) => void;
}
export async function createTaskWithCallback(params: CreateTaskWithCallbackParams) {
  let taskId: string | undefined;
  try {
    const resp = await createNewTask(params.reqData);
    if (resp.data.code === 0) {
      taskId = resp.data.data?.task_id;
    } else {
      params.onFailed(resp.data.data);
    }
  } catch (e: any) {
    params.onError(e);
  }
  if (taskId) {
    try {
      const endAt = new Date().getTime() + params.timeOut * 1000; // 最大轮询次数
      const delay = 2000; // 每次轮询间隔时间（毫秒）
      let taskInfo: Model.TaskInfo | undefined;

      while (new Date().getTime() < endAt) {
        const taskResp = await getTaskInfo(taskId);
        if (taskResp.data.data?.status === TaskStatus.SUCCESS) {
          taskInfo = taskResp.data.data;
          params.onSuccess(taskResp.data.data);
          break;
        } else if (taskResp.data.data?.status === TaskStatus.FAILED) {
          params.onFailed('fail to get task');
          break;
        } else {
          if (taskResp.data.data) {
            tLog.log(LOG_ACTIONS.SYS, 'info: ', taskResp.data.data);
            const progress = taskResp.data.data.progress;
            params.onProgress(progress || 0, taskResp.data.data.status || TaskStatus.QUEUED, taskId);
          }
        }
        await new Promise(resolve => setTimeout(resolve, delay)); // 等待一段时间后再进行下一次轮询
      }
      if (!taskInfo) {
        params.onError(new Error('time out'));
      }
    } catch (e: any) {
      params.onError(e);
    }
  }
}
