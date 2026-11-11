# پایتون ۳.۱۲ (جنگو ۶ به بالا لازم دارد)
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Tehran

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://package-mirror.liara.ir/repository/pypi/simple

COPY . .
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

CMD ["/app/entrypoint.sh"]
