import axios from 'axios';
import fs from "fs";
import path from "path";
import tLog, {LOG_ACTIONS} from "./logUtils";

export async function downloadImage(url: string, filename: string): Promise<string> {
  try {
    const response = await axios.get(url, { responseType: 'stream' });

    const dir = 'tmp';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    const outPath = path.join(dir, filename);
    const writer = fs.createWriteStream(outPath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(outPath));
      writer.on('error', reject);
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

export async function downloadImageAsUint8Array(url: string): Promise<Uint8Array | undefined> {
  try {
    // 使用 axios 进行 HTTP 请求，指定 responseType 为 arraybuffer 以获取二进制数据
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    // 将响应数据转换为 Uint8Array
    return new Uint8Array(response.data);
  } catch (error) {
    tLog.logError(LOG_ACTIONS.DEFAULT, 'Error downloading image:', error);
    // throw error;
    return undefined;
  }
}
