import {Model} from "./task";

export declare namespace ResponseProtocol {
  type Base = {
    code: number,
  }
  type TaskResp = Base & {
    data?: Model.TaskInfo,
  };
  type TaskCreateResp = Base & {
    data?: Model.CreateTextResult,
  };
  type WebBindStatusResp = Base & {
    data?: {
      id?: string,
      status?: string, // active/invalid
    }
  }
  type ImgUploadResp = Base & {
    message: string;
    data?: {
      image_token: string;
    }
  }
}
