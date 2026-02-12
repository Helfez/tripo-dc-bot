import axios, {AxiosInstance} from "axios";
import {ENVS} from "./urls";

class TRequestInstance {
  private ins?: AxiosInstance;

  get instance() {
    if (!this.ins) {
      this.ins = axios.create({
        baseURL: ENVS.apiUrl, // 替换为你的API baseURL
        timeout: 600000,
      });

      // 请求拦截器
      this.ins.interceptors.request.use(
        config => {
          // 检查是否有自定义的 Authorization 头部
          if (!config.headers['Authorization']) {
            const token = ENVS.apiKey;
            if (token) {
              config.headers['Authorization'] = `Bearer ${token}`;
            }
          }
          return config;
        },
        error => {
          // 处理请求错误
          console.error("Request Error:", error);
          return Promise.reject(error);
        }
      );

      // 响应拦截器
      this.ins.interceptors.response.use(
        response => {
          return response;
        },
        error => {
          console.error("Response Error Status:", error.response?.status);
          console.error("Response Error Data:", JSON.stringify(error.response?.data));
          const badError: any = new Error('');
          if (error.response.data) {
            badError.info = error.response.data ? error.response.data : { errCode: error.response.status,  };
            if (error.response?.headers) {
              badError.trace_id = error.response?.headers['X-Tripo-Trace-Id'] || error.response?.headers['x-tripo-trace-id'];
            }
            return Promise.reject(badError);
          }
          return Promise.reject(error);
        }
      );
    }
    return this.ins;
  }
}

const tRequest = new TRequestInstance();
export default tRequest;
