# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application's code to the working directory
COPY . .

# Define environment variables (Cloud Runは自動でPORTを注入しますが、記述していても問題ありません)
# ENV GOOGLE_CLOUD_PROJECT "rd-rag" # Cloud Runの環境変数として設定する方が一般的
# ENV GOOGLE_CLOUD_REGION "us-central1" # 同上
ENV PORT 8080
EXPOSE 8080

# Run app.py when the container launches using Gunicorn
# assuming your Flask app instance is named 'app' in 'app.py'
CMD ["sh", "-c", "gunicorn --workers 1 --threads 4 --bind 0.0.0.0:$PORT app:app"]
# 'app:app' の最初の 'app' はファイル名（app.py）、
# 2番目の 'app' はそのファイル内のFlaskアプリケーションインスタンスの変数名です。
# もしファイルが 'main.py' でアプリインスタンスが 'flask_app' なら 'main:flask_app' となります。
