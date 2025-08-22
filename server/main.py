import os
import ssl
import whisper
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 临时禁用SSL证书验证（仅用于开发环境）
ssl._create_default_https_context = ssl._create_unverified_context


app = FastAPI(title="语音转文字API")

# 添加CORS中间件，允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该设置为特定的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建临时目录用于存储上传的音频文件
os.makedirs("temp", exist_ok=True)

# 加载 Whisper 模型
print("正在加载Whisper模型...")
model = whisper.load_model("base")
print("Whisper模型加载完成！")

@app.get("/")
async def root():
    return {"message": "语音转文字API服务正在运行"}

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    try:
        # 保存上传的音频文件
        temp_file_path = os.path.join("temp", "temp_audio.webm")
        with open(temp_file_path, "wb") as temp_file:
            content = await audio.read()
            temp_file.write(content)
        
        print(f"音频文件已保存到 {temp_file_path}")
        
        # 使用 Whisper 进行语音识别
        print("开始转录...")
        result = model.transcribe(temp_file_path)
        transcribed_text = result["text"]
        print(f"转录完成: {transcribed_text}")
        
        return JSONResponse(content={"text": transcribed_text})
    except Exception as e:
        error_message = str(e)
        print(f"转录过程中出错: {error_message}")
        return JSONResponse(content={"error": error_message}, status_code=500)

if __name__ == "__main__":
    print("启动语音转文字服务...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
