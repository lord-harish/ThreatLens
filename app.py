import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from backend.main import app

# Optional Gradio integration for Hugging Face Spaces compatibility
try:
    import gradio as gr
    with gr.Blocks(title="ThreatLens") as demo:
        gr.Markdown("# ThreatLens")
    app = gr.mount_gradio_app(app, demo, path="/_hf")
except Exception:
    pass

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    print(f"Starting ThreatLens Fullstack UI on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
