import sys
import os
import logging
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.base import SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_reviewer_password():
    db = SessionLocal()
    try:
        # bcrypt hash of 'AppleReviewFit2026!'
        bcrypt_hash = "$2b$10$5u2UYMqQvSrX8/9HHxMrfO3KSSELoUcsxpKDOswd/5UTT8K5ubdsC"
        
        result = db.execute(text(
            "UPDATE public.users SET password = :hash WHERE email = :email"
        ), {"hash": bcrypt_hash, "email": "appreview@fitpilot.fit"})
        
        db.commit()
        if result.rowcount > 0:
            logger.info("Successfully updated AppleReview account password to Bcrypt!")
        else:
            logger.error("User not found.")

    except Exception as e:
        logger.error(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_reviewer_password()
