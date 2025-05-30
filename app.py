# app.py

from flask import Flask, request, jsonify, render_template
from models import db, Task # dbとTaskはmodels.pyからインポート
from datetime import datetime
from sqlalchemy import or_

# Initialize Flask app
app = Flask(__name__)
# Configure the SQLAlchemy part of the app instance
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tasks.db' # Use SQLite for simplicity
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False # Disable modification tracking to save resources
# Initialize SQLAlchemy with the Flask app
db.init_app(app)

# init_database関数はそのまま残す
def init_database():
    """Initializes the database and creates tables if they don't exist."""
    print("Initializing database...") # デバッグ用として追加
    with app.app_context():
        db.create_all()
    print("Database initialized.") # デバッグ用として追加

# init_database() # グローバルスコープでの呼び出しは削除しました

@app.route('/')
def index():
    """
    Serves the main HTML page of the application.
    """
    return render_template('index.html')

def parse_datetime(date_string):
    """
    Helper function to parse a date string into a datetime object.
    Supports 'YYYY-MM-DDTHH:MM' and 'YYYY-MM-DD' formats.
    Returns None if the string is empty or parsing fails.
    """
    if not date_string:
        return None
    try:
        # Try parsing with time first
        return datetime.strptime(date_string, '%Y-%m-%dT%H:%M')
    except ValueError:
        try:
            # Fallback to date-only parsing
            return datetime.strptime(date_string, '%Y-%m-%d')
        except ValueError:
            # Return None if both parsing attempts fail
            return None


@app.route('/get_tasks', methods=['GET'])
def get_tasks():
    """
    API endpoint to fetch active tasks (status 'todo' or 'doing').
    Supports sorting by 'display_order' (default) or 'limit_date'.
    """
    try:
        sort_by = request.args.get('sort_by', 'display_order') # Default sort by display_order

        # Base query for active tasks
        query = Task.query.filter(or_(Task.status == 'todo', Task.status == 'doing'))

        # Apply sorting based on query parameter
        if sort_by == 'limit_date':
            query = query.order_by(Task.limit_date.asc(), Task.display_order.asc())
        else: # Default or sort_by == 'display_order'
            query = query.order_by(Task.display_order.asc(), Task.limit_date.asc())
        
        tasks = query.all()
        
        # Serialize tasks to a list of dictionaries
        output = []
        for task in tasks:
            output.append({
                'id': task.id,
                'name': task.name,
                'detail': task.detail,
                'limit_date': task.limit_date.isoformat() if task.limit_date else None,
                'scheduled_start_date': task.scheduled_start_date.isoformat() if task.scheduled_start_date else None,
                'scheduled_end_date': task.scheduled_end_date.isoformat() if task.scheduled_end_date else None,
                'actual_start_date': task.actual_start_date.isoformat() if task.actual_start_date else None,
                'actual_end_date': task.actual_end_date.isoformat() if task.actual_end_date else None,
                'is_not_main': task.is_not_main,
                'status': task.status,
                'display_order': task.display_order,
                'created_at': task.created_at.isoformat(),
                'updated_at': task.updated_at.isoformat()
            })
        return jsonify(output)
    except Exception as e:
        # Generic error handler for unexpected issues
        return jsonify({'error': f'Failed to retrieve tasks: {str(e)}'}), 500

def task_to_dict(task):
    """
    Helper function to convert a Task model object to a dictionary.
    This is useful for JSON serialization.
    """
    return {
        'id': task.id,
        'name': task.name,
        'detail': task.detail,
        'limit_date': task.limit_date.isoformat() if task.limit_date else None,
        'scheduled_start_date': task.scheduled_start_date.isoformat() if task.scheduled_start_date else None,
        'scheduled_end_date': task.scheduled_end_date.isoformat() if task.scheduled_end_date else None,
        'actual_start_date': task.actual_start_date.isoformat() if task.actual_start_date else None,
        'actual_end_date': task.actual_end_date.isoformat() if task.actual_end_date else None,
        'is_not_main': task.is_not_main,
        'status': task.status,
        'display_order': task.display_order,
        'delete_reason': task.delete_reason,
        'created_at': task.created_at.isoformat(),
        'updated_at': task.updated_at.isoformat()
    }

@app.route('/task/<int:task_id>', methods=['GET'])
def get_task_detail(task_id):
    """
    API endpoint to fetch details for a specific task by its ID.
    """
    try:
        task = Task.query.get(task_id)
        if task:
            return jsonify(task_to_dict(task))
        else:
            return jsonify({'error': 'Task not found'}), 404 # Not Found
    except Exception as e:
        return jsonify({'error': f'Failed to retrieve task details: {str(e)}'}), 500

@app.route('/update_task/<int:task_id>', methods=['POST'])
def update_task(task_id):
    """
    API endpoint to update an existing task's details.
    """
    try:
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        data = request.get_json() # Get data from JSON payload

        # Extract and validate required fields
        name = data.get('name')
        if not name:
            return jsonify({'error': 'Name is required'}), 400 # Bad Request

        limit_date_str = data.get('limit_date')
        if not limit_date_str:
            return jsonify({'error': 'Limit date is required'}), 400
        
        limit_date = parse_datetime(limit_date_str)
        if not limit_date:
            return jsonify({'error': f'Invalid limit_date format: . Use YYYY-MM-DD or YYYY-MM-DDTHH:MM'}), 400

        # Extract and validate optional date fields
        scheduled_start_date_str = data.get('scheduled_start_date')
        scheduled_end_date_str = data.get('scheduled_end_date')
        
        scheduled_start_date = parse_datetime(scheduled_start_date_str)
        scheduled_end_date = parse_datetime(scheduled_end_date_str)

        if scheduled_start_date_str and not scheduled_start_date:
             return jsonify({'error': f'Invalid scheduled_start_date format: . Use YYYY-MM-DD or YYYY-MM-DDTHH:MM'}), 400
        
        if scheduled_end_date_str and not scheduled_end_date:
            return jsonify({'error': f'Invalid scheduled_end_date format: . Use YYYY-MM-DD or YYYY-MM-DDTHH:MM'}), 400

        # Validate consistency of scheduled dates
        if (scheduled_start_date and not scheduled_end_date) or \
           (not scheduled_start_date and scheduled_end_date):
            return jsonify({'error': 'Both scheduled_start_date and scheduled_end_date must be provided if one is present, or both left empty.'}), 400

        # Extract is_not_main (newly added for update)
        is_not_main = data.get('is_not_main', task.is_not_main) # Default to existing value if not provided

        # Update task attributes
        task.name = name
        task.detail = data.get('detail') # Detail is optional
        task.limit_date = limit_date
        task.scheduled_start_date = scheduled_start_date
        task.scheduled_end_date = scheduled_end_date
        task.is_not_main = is_not_main # ★★★ ADDED: Update is_not_main ★★★
        # is_not_main and status are handled by other specific routes or not updated here by default
        task.updated_at = datetime.utcnow() # Update timestamp

        db.session.commit() # Commit changes to the database
        return jsonify({'message': 'Task updated successfully'})

    except Exception as e:
        db.session.rollback() # Rollback in case of error
        return jsonify({'error': f'Failed to update task: {str(e)}'}), 500

@app.route('/delete_task/<int:task_id>', methods=['POST'])
def delete_task_route(task_id):
    """
    API endpoint to soft-delete a task (mark as 'deleted').
    """
    try:
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        data = request.get_json()
        delete_reason = data.get('delete_reason', None) # Optional reason for deletion

        # Perform soft delete
        task.status = 'deleted'
        task.delete_reason = delete_reason
        task.actual_end_date = datetime.utcnow() # Mark deletion time as actual end time
        task.updated_at = datetime.utcnow()

        db.session.commit()
        return jsonify({'message': 'Task deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete task: {str(e)}'}), 500

@app.route('/start_task/<int:task_id>', methods=['POST'])
def start_task_route(task_id):
    """
    API endpoint to mark a task as 'doing' and set its actual start time.
    """
    try:
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        # Handle idempotency: if already completed, do nothing further.
        if task.status == 'completed':
            return jsonify({'message': 'Task is already completed', 'actual_start_date': task.actual_start_date.isoformat() if task.actual_start_date else None}), 200
        
        # Set actual_start_date only if not already set (first time starting)
        task.actual_start_date = task.actual_start_date or datetime.utcnow() 
        task.status = 'doing' # Update status
        task.updated_at = datetime.utcnow()

        db.session.commit()
        return jsonify({
            'message': 'Task started', 
            'actual_start_date': task.actual_start_date.isoformat(),
            'status': task.status
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to start task: {str(e)}'}), 500

# NEW: API endpoint to "pause" or "stop" a task (return to todo)
@app.route('/pause_task/<int:task_id>', methods=['POST'])
def pause_task_route(task_id):
    """
    API endpoint to revert a 'doing' task back to 'todo' status.
    Keeps actual_start_date if already set, but clears actual_end_date (if it was set).
    """
    try:
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        if task.status != 'doing':
            return jsonify({'error': 'Task is not in a "doing" state and cannot be paused.'}), 400

        task.status = 'todo'
        task.actual_end_date = None # Clear end date if it was set (e.g. if it was completed and then restored)
        task.updated_at = datetime.utcnow()

        db.session.commit()
        return jsonify({
            'message': 'Task paused (returned to todo)',
            'task_id': task.id,
            'new_status': task.status
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to pause task: {str(e)}'}), 500


@app.route('/end_task/<int:task_id>', methods=['POST'])
def end_task_route(task_id):
    """
    API endpoint to mark a task as 'completed' and set its actual end time.
    """
    try:
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        # Handle idempotency: if already completed, do nothing further.
        if task.status == 'completed':
            return jsonify({'message': 'Task is already completed', 'actual_end_date': task.actual_end_date.isoformat() if task.actual_end_date else None}), 200

        # Ensure task has a start time; if not, set it to now (e.g., if started and ended immediately)
        if not task.actual_start_date: 
            task.actual_start_date = datetime.utcnow()
        
        task.actual_end_date = datetime.utcnow() # Set actual end time
        task.status = 'completed' # Update status
        task.updated_at = datetime.utcnow()

        db.session.commit()
        return jsonify({
            'message': 'Task completed', 
            'actual_start_date': task.actual_start_date.isoformat(),
            'actual_end_date': task.actual_end_date.isoformat(),
            'status': task.status
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to end task: {str(e)}'}), 500

@app.route('/update_task_order', methods=['POST'])
def update_task_order():
    """
    API endpoint to update the display order of tasks.
    Expects a JSON payload with a list of task IDs in the new desired order.
    """
    data = request.get_json()
    ordered_ids = data.get('ordered_ids')

    if not ordered_ids or not isinstance(ordered_ids, list):
        return jsonify({'error': 'Invalid payload. "ordered_ids" must be a list.'}), 400

    try:
        # Use a nested transaction to ensure all order updates succeed or fail together.
        with db.session.begin_nested(): 
            for index, task_id in enumerate(ordered_ids):
                task = Task.query.get(task_id)
                if task:
                    task.display_order = index # Update display_order based on new position
                    task.updated_at = datetime.utcnow()
                else:
                    # This case should ideally not happen if frontend and backend are in sync.
                    return jsonify({'error': f'Task with ID {task_id} not found during reorder.'}), 404 
        db.session.commit() # Commit the main transaction if nested transaction was successful
        return jsonify({'message': 'Task order updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update task order: {str(e)}'}), 500

@app.route('/get_completed_tasks', methods=['GET'])
def get_completed_tasks():
    """
    API endpoint to fetch all tasks marked as 'completed'.
    Tasks are ordered by their actual end date, descending (most recent first).
    """
    try:
        tasks = Task.query.filter_by(status='completed').order_by(Task.actual_end_date.desc()).all()
        return jsonify([task_to_dict(task) for task in tasks]) # Serialize using helper
    except Exception as e:
        return jsonify({'error': f'Failed to retrieve completed tasks: {str(e)}'}), 500

@app.route('/get_deleted_tasks', methods=['GET'])
def get_deleted_tasks():
    """
    API endpoint to fetch all tasks marked as 'deleted'.
    Tasks are ordered by their last update time (deletion time), descending.
    """
    try:
        tasks = Task.query.filter_by(status='deleted').order_by(Task.updated_at.desc()).all()
        return jsonify([task_to_dict(task) for task in tasks]) # Serialize using helper
    except Exception as e:
        return jsonify({'error': f'Failed to retrieve deleted tasks: {str(e)}'}), 500

@app.route('/restore_task/<int:task_id>', methods=['POST'])
def restore_task_route(task_id):
    """
    API endpoint to restore a 'completed' or 'deleted' task back to 'todo'.
    """
    try:
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        if task.status not in ['completed', 'deleted']:
            return jsonify({'error': 'Task is not in a restorable state (must be completed or deleted).'}), 400

        # Restore logic
        task.status = 'todo'  # Always restore to 'todo'
        task.actual_end_date = None # Clear actual end date
        task.delete_reason = None   # Clear delete reason
        # actual_start_date can remain, indicating it was once started.
        # display_order is kept. It will reappear in active tasks based on this order.
        # If it needs to go to the top, display_order should be reset to 0 or handled by a specific re-prioritization feature.
        task.updated_at = datetime.utcnow()

        db.session.commit()
        return jsonify({
            'message': 'Task restored successfully',
            'task_id': task.id,
            'new_status': task.status 
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to restore task: {str(e)}'}), 500

@app.route('/add_task', methods=['POST'])
def add_task():
    """
    API endpoint to create a new task.
    """
    data = request.get_json()

    # Required fields
    name = data.get('name')
    limit_date_str = data.get('limit_date')

    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if not limit_date_str: 
        return jsonify({'error': 'Limit date is required'}), 400
    
    limit_date = parse_datetime(limit_date_str)
    if not limit_date:
        return jsonify({'error': f'Invalid limit_date format: . Use YYYY-MM-DD or YYYY-MM-DDTHH:MM'}), 400

    # Optional fields
    detail = data.get('detail')
    scheduled_start_date_str = data.get('scheduled_start_date')
    scheduled_end_date_str = data.get('scheduled_end_date')
    is_not_main = data.get('is_not_main', False) # Default to False if not provided

    scheduled_start_date = parse_datetime(scheduled_start_date_str)
    scheduled_end_date = parse_datetime(scheduled_end_date_str)

    # Validate format of optional dates if strings were provided but parsing failed
    if scheduled_start_date_str and not scheduled_start_date:
        return jsonify({'error': f'Invalid scheduled_start_date format: . Use YYYY-MM-DD or YYYY-MM-DDTHH:MM'}), 400
    if scheduled_end_date_str and not scheduled_end_date:
        return jsonify({'error': f'Invalid scheduled_end_date format: . Use YYYY-MM-DD or YYYY-MM-DDTHH:MM'}), 400
            
    # Validate consistency: if one scheduled date is given, the other must also be.
    if (scheduled_start_date and not scheduled_end_date) or \
       (not scheduled_start_date and scheduled_end_date):
        return jsonify({'error': 'Both scheduled_start_date and scheduled_end_date must be provided if one is present, or both left empty.'}), 400

    # Create new Task object
    new_task = Task(
        name=name,
        detail=detail,
        limit_date=limit_date,
        scheduled_start_date=scheduled_start_date,
        scheduled_end_date=scheduled_end_date,
        is_not_main=is_not_main
        # status, display_order, created_at, updated_at will use defaults from the model
    )

    try:
        db.session.add(new_task) # Add to session
        db.session.commit()      # Commit to database
        return jsonify({'message': 'Task created successfully', 'task_id': new_task.id}), 201 # Created
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create task: {str(e)}'}), 500

if __name__ == '__main__':
    # このブロックでのみデータベースを初期化するように変更
    init_database() # <-- init_database()の呼び出しをここに移動
    # Run the Flask development server
    app.run(debug=True) # debug=True enables auto-reloading and debugger