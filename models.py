from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Initialize the SQLAlchemy database instance.
# This instance will be used to define models and interact with the database.
db = SQLAlchemy()

class Task(db.Model):
    """
    Represents a single task in the task management application.
    """
    __tablename__ = 'tasks'  # Explicitly naming the table (optional but good practice)

    # Core Task Information
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)  # Unique identifier for the task
    name = db.Column(db.String(255), nullable=False)  # Name or title of the task (e.g., "Write report")
    detail = db.Column(db.Text, nullable=True)        # Detailed description of the task

    # Dates and Scheduling
    limit_date = db.Column(db.DateTime, nullable=False) # Deadline for the task
    scheduled_start_date = db.Column(db.DateTime, nullable=True) # Planned start date and time
    scheduled_end_date = db.Column(db.DateTime, nullable=True)   # Planned end date and time
    actual_start_date = db.Column(db.DateTime, nullable=True)    # Actual start date and time
    actual_end_date = db.Column(db.DateTime, nullable=True)      # Actual end date and time (completion or deletion)

    # Task Attributes
    display_order = db.Column(db.Integer, nullable=False, default=0) # Order in which tasks are displayed, 0 is highest priority
    is_not_main = db.Column(db.Boolean, default=False, nullable=False) # Flag to indicate if it's a sub-task or minor task
    
    # Task Status and Lifecycle
    # Possible values: "todo", "doing", "completed", "deleted"
    status = db.Column(db.String(50), default="todo", nullable=False) 
    delete_reason = db.Column(db.Text, nullable=True) # Reason for task deletion, if applicable

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False) # Timestamp of task creation
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False) # Timestamp of last update

    def __repr__(self):
        """
        String representation of the Task object, useful for debugging.
        """
        return f'<Task {self.id}: {self.name} ({self.status})>'
