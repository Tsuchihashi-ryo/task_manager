from flask import Flask, request, jsonify, render_template
from models import db, Task
from datetime import datetime
from sqlalchemy import or_

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tasks.db'
db.init_app(app)

@app.route('/')
def index():
    return render_template('index.html')

def parse_datetime(date_string):
    if not date_string:
        return None
    # Try parsing with time first, then fallback to date only
    try:
        return datetime.strptime(date_string, '%Y-%m-%dT%H:%M')
    except ValueError:
        try:
            return datetime.strptime(date_string, '%Y-%m-%d')
        except ValueError:
             # Handle cases where the string might be empty or invalid after checks
            return None


@app.route('/get_tasks', methods=['GET'])
def get_tasks():
    try:
        tasks = Task.query.filter(
            or_(Task.status == 'todo', Task.status == 'doing')
        ).order_by(Task.display_order.asc(), Task.limit_date.asc()).all()
        
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
        return jsonify({'error': str(e)}), 500

# Helper to convert model to dict, can be expanded
def task_to_dict(task):
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
    try:
        task = Task.query.get(task_id)
        if task:
            return jsonify(task_to_dict(task))
        else:
            return jsonify({'error': 'Task not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/update_task/<int:task_id>', methods=['POST'])
def update_task(task_id):
    try:
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        data = request.get_json()

        name = data.get('name')
        detail = data.get('detail')
        limit_date_str = data.get('limit_date')
        scheduled_start_date_str = data.get('scheduled_start_date')
        scheduled_end_date_str = data.get('scheduled_end_date')

        if not name:
            return jsonify({'error': 'Name is required'}), 400
        
        if not limit_date_str:
            return jsonify({'error': 'Limit date is required'}), 400
        
        limit_date = parse_datetime(limit_date_str)
        if not limit_date:
            return jsonify({'error': f'Invalid limit_date format: {limit_date_str}. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM'}), 400

        scheduled_start_date = parse_datetime(scheduled_start_date_str)
        scheduled_end_date = parse_datetime(scheduled_end_date_str)

        if scheduled_start_date_str and not scheduled_start_date:
             return jsonify({'error': f'Invalid scheduled_start_date format: {scheduled_start_date_str}. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM'}), 400
        
        if scheduled_end_date_str and not scheduled_end_date:
            return jsonify({'error': f'Invalid scheduled_end_date format: {scheduled_end_date_str}. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM'}), 400

        if (scheduled_start_date and not scheduled_end_date) or \
           (not scheduled_start_date and scheduled_end_date):
            return jsonify({'error': 'Both scheduled_start_date and scheduled_end_date must be provided if one is present, or both left empty.'}), 400

        task.name = name
        task.detail = detail
        task.limit_date = limit_date
        task.scheduled_start_date = scheduled_start_date
        task.scheduled_end_date = scheduled_end_date
        task.updated_at = datetime.utcnow()

        db.session.commit()
        return jsonify({'message': 'Task updated successfully'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/delete_task/<int:task_id>', methods=['POST'])
def delete_task_route(task_id):
    try:
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        data = request.get_json()
        delete_reason = data.get('delete_reason', None)

        task.status = 'deleted'
        task.delete_reason = delete_reason
        task.actual_end_date = datetime.utcnow() # Mark end time as now
        task.updated_at = datetime.utcnow()

        db.session.commit()
        return jsonify({'message': 'Task deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/start_task/<int:task_id>', methods=['POST'])
def start_task_route(task_id):
    try:
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        # Idempotency: if already started and 'doing', or 'completed', maybe just return current state
        if task.status == 'completed':
            return jsonify({'message': 'Task is already completed', 'actual_start_date': task.actual_start_date.isoformat() if task.actual_start_date else None}), 200
        
        task.actual_start_date = task.actual_start_date or datetime.utcnow() # Set if not already set
        task.status = 'doing'
        task.updated_at = datetime.utcnow()

        db.session.commit()
        return jsonify({
            'message': 'Task started', 
            'actual_start_date': task.actual_start_date.isoformat(),
            'status': task.status
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/end_task/<int:task_id>', methods=['POST'])
def end_task_route(task_id):
    try:
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        if task.status == 'completed':
            return jsonify({'message': 'Task is already completed', 'actual_end_date': task.actual_end_date.isoformat() if task.actual_end_date else None}), 200

        if not task.actual_start_date: # Task must be started before it can be ended
            task.actual_start_date = datetime.utcnow()
        
        task.actual_end_date = datetime.utcnow()
        task.status = 'completed'
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
        return jsonify({'error': str(e)}), 500

@app.route('/add_task', methods=['POST'])
def add_task():
    data = request.get_json()

    name = data.get('name')
    detail = data.get('detail')
    limit_date_str = data.get('limit_date')
    scheduled_start_date_str = data.get('scheduled_start_date')
    scheduled_end_date_str = data.get('scheduled_end_date')
    is_not_main = data.get('is_not_main', False)

    if not name:
        return jsonify({'error': 'Name is required'}), 400

    if not limit_date_str: # Limit date is required
        return jsonify({'error': 'Limit date is required'}), 400
    
    limit_date = parse_datetime(limit_date_str)
    if not limit_date:
        return jsonify({'error': f'Invalid limit_date format: {limit_date_str}. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM'}), 400

    scheduled_start_date = parse_datetime(scheduled_start_date_str)
    scheduled_end_date = parse_datetime(scheduled_end_date_str)

    if scheduled_start_date_str and not scheduled_start_date: # Check if original string was present but parsing failed
        return jsonify({'error': f'Invalid scheduled_start_date format: {scheduled_start_date_str}. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM'}), 400
    
    if scheduled_end_date_str and not scheduled_end_date: # Check if original string was present but parsing failed
        return jsonify({'error': f'Invalid scheduled_end_date format: {scheduled_end_date_str}. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM'}), 400
            
    if (scheduled_start_date and not scheduled_end_date) or (not scheduled_start_date and scheduled_end_date):
        return jsonify({'error': 'Both scheduled_start_date and scheduled_end_date must be provided if one is present, or both left empty.'}), 400

    new_task = Task(
        name=name,
        detail=detail,
        limit_date=limit_date,
        scheduled_start_date=scheduled_start_date,
        scheduled_end_date=scheduled_end_date,
        is_not_main=is_not_main
    )

    try:
        db.session.add(new_task)
        db.session.commit()
        return jsonify({'message': 'Task created successfully', 'task_id': new_task.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create task: {str(e)}'}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
