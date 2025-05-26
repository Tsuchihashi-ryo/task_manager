from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String, nullable=False)
    detail = db.Column(db.Text, nullable=True)
    limit_date = db.Column(db.DateTime, nullable=False)
    scheduled_start_date = db.Column(db.DateTime, nullable=True)
    scheduled_end_date = db.Column(db.DateTime, nullable=True)
    actual_start_date = db.Column(db.DateTime, nullable=True)
    actual_end_date = db.Column(db.DateTime, nullable=True)
    display_order = db.Column(db.Integer, nullable=True, default=0)
    is_not_main = db.Column(db.Boolean, default=False)
    status = db.Column(db.String, default="todo")
    delete_reason = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Task {self.name}>'
