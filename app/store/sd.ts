import {
  SiliconFlow,
  StoreKey,
  ACCESS_CODE_PREFIX,
  ApiPath,
  SILICONFLOW_BASE_URL,
} from "@/app/constant";
import { getBearerToken } from "@/app/client/api";
import { createPersistStore } from "@/app/utils/store";
import { nanoid } from "nanoid";
import { uploadImage, base64Image2Blob } from "@/app/utils/chat";
import { models, getModelParamBasicData } from "@/app/components/sd/sd-panel";
import { useAccessStore } from "./access";
import { getClientConfig } from "@/app/config/client";

const defaultModel = {
  name: models[0].name,
  value: models[0].value,
};

const defaultParams = getModelParamBasicData(models[0].params({}), {});

const DEFAULT_SD_STATE = {
  currentId: 0,
  draw: [],
  currentModel: defaultModel,
  currentParams: defaultParams,
};

export const useSdStore = createPersistStore<
  {
    currentId: number;
    draw: any[];
    currentModel: typeof defaultModel;
    currentParams: any;
  },
  {
    getNextId: () => number;
    sendTask: (data: any, okCall?: Function) => void;
    updateDraw: (draw: any) => void;
    setCurrentModel: (model: any) => void;
    setCurrentParams: (data: any) => void;
  }
>(
  DEFAULT_SD_STATE,
  (set, _get) => {
    function get() {
      return {
        ..._get(),
        ...methods,
      };
    }

    const methods = {
      getNextId() {
        const id = ++_get().currentId;
        set({ currentId: id });
        return id;
      },
      sendTask(data: any, okCall?: Function) {
        data = { ...data, id: nanoid(), status: "running" };
        set({ draw: [data, ..._get().draw] });
        this.getNextId();
        this.siliconFlowRequestCall(data);
        okCall?.();
      },
      async siliconFlowRequestCall(data: any) {
        const accessStore = useAccessStore.getState();
        const isApp = !!getClientConfig()?.isApp;

        let baseUrl = "";
        let bearerToken = "";

        if (accessStore.useCustomConfig) {
          baseUrl = accessStore.siliconflowUrl || SILICONFLOW_BASE_URL;
          bearerToken = getBearerToken(accessStore.siliconflowApiKey);
        } else {
          baseUrl = isApp ? SILICONFLOW_BASE_URL : ApiPath.SiliconFlow;
        }

        if (!bearerToken && accessStore.enabledAccessControl()) {
          bearerToken = getBearerToken(
            ACCESS_CODE_PREFIX + accessStore.accessCode,
          );
        }

        if (!baseUrl.startsWith("http") && !baseUrl.startsWith(ApiPath.SiliconFlow)) {
          baseUrl = `https://${baseUrl}`;
        }

        if (baseUrl.endsWith("/")) {
          baseUrl = baseUrl.slice(0, -1);
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
        };

        if (bearerToken) {
          headers["Authorization"] = bearerToken;
        }

        const url = `${baseUrl}/${SiliconFlow.ImagePath}`;

        const requestBody: Record<string, any> = {
          model: data.model,
          prompt: data.params.prompt,
          image_size: data.params.image_size || "1024x1024",
          batch_size: 1,
        };

        if (data.params.negative_prompt) {
          requestBody.negative_prompt = data.params.negative_prompt;
        }
        if (data.params.seed && data.params.seed > 0) {
          requestBody.seed = data.params.seed;
        }
        if (data.params.num_inference_steps) {
          requestBody.num_inference_steps = data.params.num_inference_steps;
        }
        if (data.params.guidance_scale !== undefined) {
          requestBody.guidance_scale = data.params.guidance_scale;
        }

        console.log("[SiliconFlow Image] Request:", { url, requestBody });

        try {
          const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
          });

          const resData = await response.json();
          console.log("[SiliconFlow Image] Response:", resData);

          if (!response.ok || resData.error) {
            this.updateDraw({
              ...data,
              status: "error",
              error: resData.message || resData.error || "Request failed",
            });
            this.getNextId();
            return;
          }

          if (resData.images && resData.images.length > 0) {
            const imageData = resData.images[0];

            if (imageData.url) {
              this.updateDraw({
                ...data,
                status: "success",
                img_data: imageData.url,
              });
              this.getNextId();
            } else if (imageData.b64_json) {
              const imageBase64 = imageData.b64_json;
              const self = this;
              uploadImage(base64Image2Blob(imageBase64, "image/png"))
                .then((img_data) => {
                  console.debug("uploadImage success", img_data);
                  self.updateDraw({
                    ...data,
                    status: "success",
                    img_data,
                  });
                })
                .catch((e) => {
                  console.error("uploadImage error", e);
                  self.updateDraw({
                    ...data,
                    status: "error",
                    error: JSON.stringify(e),
                  });
                })
                .finally(() => {
                  self.getNextId();
                });
            } else {
              this.updateDraw({
                ...data,
                status: "error",
                error: "No image data in response",
              });
              this.getNextId();
            }
          } else {
            this.updateDraw({
              ...data,
              status: "error",
              error: "No images in response",
            });
            this.getNextId();
          }
        } catch (error: any) {
          console.error("[SiliconFlow Image] Error:", error);
          this.updateDraw({ ...data, status: "error", error: error.message });
          this.getNextId();
        }
      },
      updateDraw(_draw: any) {
        const draw = _get().draw || [];
        draw.some((item, index) => {
          if (item.id === _draw.id) {
            draw[index] = _draw;
            set(() => ({ draw }));
            return true;
          }
        });
      },
      setCurrentModel(model: any) {
        set({ currentModel: model });
      },
      setCurrentParams(data: any) {
        set({
          currentParams: data,
        });
      },
    };

    return methods;
  },
  {
    name: StoreKey.SdList,
    version: 1.1,
  },
);
