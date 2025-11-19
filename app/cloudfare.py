import boto3
import uuid
from datetime import datetime
import os
from botocore.config import Config

class R2UploadService:
    def __init__(self):
        config = Config(
            signature_version='s3v4',
            s3={'addressing_style': 'virtual'}
        )
        
        self.s3_client = boto3.client(
            's3',
            endpoint_url=os.getenv("R2_ENDPOINT"),
            aws_access_key_id=os.getenv("R2_ACCESS_KEY"),
            aws_secret_access_key=os.getenv("R2_SECRET_KEY"),
            config=config
        )
        self.bucket = os.getenv("R2_BUCKET", "recordings")
        
        # Use your ACTUAL development URL
        self.public_base_url = "https://pub-de94145f5f0e4c39b93b6db978cc0969.r2.dev"
    
    def generate_upload_url(self, user_email: str, filename: str, file_size: int) -> dict:
        if not filename.lower().endswith('.webm'):
            raise ValueError("Only WebM files are allowed")
        
        max_size = 500 * 1024 * 1024
        if file_size > max_size:
            raise ValueError(f"File too large. Max size: {max_size // 1024 // 1024}MB")
        
        file_key = self._generate_file_key(user_email, filename)
        
        upload_url = self.s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': self.bucket,
                'Key': file_key,
                'ContentType': 'video/webm',
            },
            ExpiresIn=1800,
            HttpMethod='PUT'
        )
        
        public_url = f"{self.public_base_url}/{file_key}"
        
        return {
            'upload_url': upload_url,
            'file_key': file_key,
            'public_url': public_url,
            'expires_in': 1800
        }
    
    def _generate_file_key(self, user_email: str, filename: str) -> str:
        safe_email = user_email.replace('@', '_at_').replace('.', '_')
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        file_ext = filename.split('.')[-1].lower()
        
        return f"users/{safe_email}/recording_{timestamp}_{unique_id}.{file_ext}"

r2_service = R2UploadService()