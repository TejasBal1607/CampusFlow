from datetime import datetime
import pytz




# The single source of truth for your app's time
IST = pytz.timezone('Asia/Kolkata')

def get_now_ist():
    """Returns the full datetime object for right now in Patiala."""
    return datetime.now(IST)

def get_today_ist():
    """Returns just the date (YYYY-MM-DD) for right now in Patiala."""
    return datetime.now(IST).date()