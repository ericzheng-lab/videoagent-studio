import oss2
import os
import time
import uuid

# ==========================================
# 阿里云 OSS 配置信息
# ==========================================
ACCESS_KEY_ID = 'LTAI5tLxHjmUc4uuT5P1G92r'
ACCESS_KEY_SECRET = '1E4cwzklYSnkaatu08UtTyOnl9E7gj'
ENDPOINT = 'oss-cn-hangzhou.aliyuncs.com'
BUCKET_NAME = 'drs-88'

def upload_image_to_oss(local_file_path):
    """
    将本地图片上传到阿里云 OSS，并返回可以直接给 Kling API 使用的纯净直链。
    """
    # 1. 检查本地文件是否存在
    if not os.path.exists(local_file_path):
        print(f"[ERROR] 找不到本地文件 {local_file_path}")
        return None

    # 2. 自动生成云端文件名
    date_prefix = time.strftime("%Y%m")
    unique_id = str(uuid.uuid4())[:8]
    original_filename = os.path.basename(local_file_path)
    object_name = f"kling-images/{date_prefix}/{unique_id}_{original_filename}"

    # 3. 认证并连接到 Bucket
    try:
        auth = oss2.Auth(ACCESS_KEY_ID, ACCESS_KEY_SECRET)
        bucket = oss2.Bucket(auth, ENDPOINT, BUCKET_NAME)
    except Exception as e:
        print(f"[ERROR] 认证失败: {e}")
        return None

    # 4. 执行上传
    print(f"[INFO] 上传 {original_filename} 到阿里云 OSS...")
    try:
        bucket.put_object_from_file(object_name, local_file_path)
        
        # 5. 返回公共访问直链
        public_url = f"https://{BUCKET_NAME}.{ENDPOINT}/{object_name}"
        
        print(f"[SUCCESS] 上传成功!")
        print(f"[URL] {public_url}")
        
        return public_url
        
    except Exception as e:
        print(f"[ERROR] 上传失败: {e}")
        return None

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python ali-oss.py <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    result = upload_image_to_oss(image_path)
    if result:
        print(result)
