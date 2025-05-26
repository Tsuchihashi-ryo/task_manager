document.addEventListener('DOMContentLoaded', function() {
    const addTaskBtn = document.getElementById('add-new-task-btn');
    const addTaskPopup = document.getElementById('add-task-popup');
    const cancelAddTaskBtn = document.getElementById('cancel-add-task-btn');
    const addTaskForm = document.getElementById('add-task-form');
    const popupOverlay = document.getElementById('popup-overlay'); // Shared overlay
    const addErrorMessageDiv = document.getElementById('add-task-error-message');
    const taskListArea = document.getElementById('task-list-area');

    // Edit Task Popup Elements
    const editTaskPopup = document.getElementById('edit-task-popup');
    const editTaskForm = document.getElementById('edit-task-form');
    const cancelEditTaskBtn = document.getElementById('cancel-edit-task-btn');
    const editErrorMessageDiv = document.getElementById('edit-task-error-message');
    const editTaskIdInput = document.getElementById('edit-task-id');
    const deleteFromEditBtn = document.getElementById('delete-task-btn'); 
    const startTaskBtn = document.getElementById('start-task-btn');
    const endTaskBtn = document.getElementById('end-task-btn');

    // Delete Confirmation Popup Elements
    const deleteConfirmPopup = document.getElementById('delete-confirm-popup');
    const cancelDeleteConfirmBtn = document.getElementById('cancel-delete-confirm-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const deleteReasonInput = document.getElementById('delete_reason_input');
    const deleteTaskIdConfirmInput = document.getElementById('delete-task-id-confirm');
    const deleteConfirmErrorMessageDiv = document.getElementById('delete-confirm-error-message');

    // Store current task details when edit popup is open
    let currentEditTaskDetails = null;

    // --- Helper to format datetime for input[type="datetime-local"] ---
    function formatDateTimeForInput(isoString) {
        if (!isoString) return "";
        return isoString.substring(0, 16);
    }

    // --- Add Task Popup Management ---
    function showAddTaskPopup() {
        addTaskPopup.style.display = 'block';
        if (popupOverlay) popupOverlay.style.display = 'block';
        addErrorMessageDiv.textContent = '';
        addTaskForm.reset();
    }

    function hideAddTaskPopup() {
        addTaskPopup.style.display = 'none';
        if (popupOverlay && deleteConfirmPopup.style.display === 'none' && editTaskPopup.style.display === 'none') {
            popupOverlay.style.display = 'none';
        }
    }

    addTaskBtn.addEventListener('click', showAddTaskPopup);
    cancelAddTaskBtn.addEventListener('click', hideAddTaskPopup);

    // --- Edit Task Popup Management ---
    function showEditTaskPopup() {
        editTaskPopup.style.display = 'block';
        if (popupOverlay) popupOverlay.style.display = 'block';
        editErrorMessageDiv.textContent = '';
        deleteFromEditBtn.disabled = false; // Ensure delete button is enabled
    }

    function hideEditTaskPopup() {
        editTaskPopup.style.display = 'none';
        if (popupOverlay && deleteConfirmPopup.style.display === 'none' && addTaskPopup.style.display === 'none') {
            popupOverlay.style.display = 'none';
        }
    }

    cancelEditTaskBtn.addEventListener('click', hideEditTaskPopup);

    // --- Delete Confirmation Popup Management ---
    function showDeleteConfirmPopup(taskId) {
        deleteTaskIdConfirmInput.value = taskId;
        deleteReasonInput.value = ''; // Clear reason
        deleteConfirmErrorMessageDiv.textContent = '';
        
        hideEditTaskPopup(); // Hide edit popup first
        
        deleteConfirmPopup.style.display = 'block';
        if (popupOverlay) popupOverlay.style.display = 'block'; // Ensure overlay is visible
    }

    function hideDeleteConfirmPopup() {
        deleteConfirmPopup.style.display = 'none';
        if (popupOverlay && editTaskPopup.style.display === 'none' && addTaskPopup.style.display === 'none') {
            popupOverlay.style.display = 'none';
        }
    }

    cancelDeleteConfirmBtn.addEventListener('click', hideDeleteConfirmPopup);

    // --- Overlay general click handler ---
    if (popupOverlay) {
        popupOverlay.addEventListener('click', () => {
            hideAddTaskPopup();
            hideEditTaskPopup();
            hideDeleteConfirmPopup();
        });
    }

    // --- Event Listener for "Delete" button in Edit Popup ---
    deleteFromEditBtn.addEventListener('click', () => {
        const taskId = editTaskIdInput.value;
        if (taskId) {
            showDeleteConfirmPopup(taskId);
        } else {
            // Should not happen if form is populated correctly
            console.error("Task ID not found in edit form for deletion.");
        }
    });

    // --- Task Rendering (with click listener for edit) ---
    function renderTasks(tasks) {
        taskListArea.innerHTML = ''; // Clear existing tasks

        if (!tasks || tasks.length === 0) {
            const noTasksMessage = document.createElement('p');
            noTasksMessage.textContent = 'No active tasks.';
            taskListArea.appendChild(noTasksMessage);
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'task-list';
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'task-item';
            li.dataset.taskId = task.id; // Store task ID
            li.id = `task-item-${task.id}`;


            const nameDiv = document.createElement('div');
            nameDiv.className = 'task-name';
            nameDiv.textContent = task.name;
            if (task.is_not_main) {
                nameDiv.classList.add('minor-task');
            }

            const limitDateDiv = document.createElement('div');
            limitDateDiv.className = 'task-limit-date';
            limitDateDiv.textContent = `Limit: ${task.limit_date ? new Date(task.limit_date).toLocaleString() : 'N/A'}`;
            
            const scheduledDatesDiv = document.createElement('div');
            scheduledDatesDiv.className = 'task-scheduled-dates';
            if (task.scheduled_start_date && task.scheduled_end_date) {
                scheduledDatesDiv.textContent = `Scheduled: ${new Date(task.scheduled_start_date).toLocaleDateString()} - ${new Date(task.scheduled_end_date).toLocaleDateString()}`;
            } else {
                scheduledDatesDiv.textContent = 'Scheduled: Not set';
            }

            li.appendChild(nameDiv);
            li.appendChild(limitDateDiv);
            li.appendChild(scheduledDatesDiv);
            
            // Event listener for opening the edit popup
            li.addEventListener('click', async () => {
                const taskId = li.dataset.taskId;
                editErrorMessageDiv.textContent = ''; // Clear previous errors
                try {
                    const response = await fetch(`/task/${taskId}`);
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                    }
                    const taskDetails = await response.json();
                    
                    // Populate edit form
                    editTaskIdInput.value = taskDetails.id;
                    document.getElementById('edit-task-name').value = taskDetails.name;
                    document.getElementById('edit-task-detail').value = taskDetails.detail || "";
                    document.getElementById('edit-task-limit-date').value = formatDateTimeForInput(taskDetails.limit_date);
                    document.getElementById('edit-task-scheduled-start-date').value = formatDateTimeForInput(taskDetails.scheduled_start_date);
                    document.getElementById('edit-task-scheduled-end-date').value = formatDateTimeForInput(taskDetails.scheduled_end_date);
                    // TODO: Handle other fields like status, is_not_main if they become editable in this form

                    showEditTaskPopup();
                } catch (error) {
                    console.error('Error fetching task details:', error);
                    editErrorMessageDiv.textContent = `Error: ${error.message}`; 
                    // Optionally, don't show popup or show a general error in popup
                }
            });

            ul.appendChild(li);
        });
        taskListArea.appendChild(ul);
    }

    // --- API Calls (fetchAndRenderActiveTasks remains the same) ---
    async function fetchAndRenderActiveTasks() {
        try {
            const response = await fetch('/get_tasks');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const tasks = await response.json();
            renderTasks(tasks);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            taskListArea.innerHTML = `<p style="color: red;">Error loading tasks: ${error.message}</p>`;
        }
    }

    // --- Form Submission for Adding Task ---
    addTaskForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        addErrorMessageDiv.textContent = ''; // Use specific error div

        const name = document.getElementById('task-name').value;
        const detail = document.getElementById('task-detail').value;
        const limit_date = document.getElementById('task-limit-date').value;
        let scheduled_start_date = document.getElementById('task-scheduled-start-date').value;
        let scheduled_end_date = document.getElementById('task-scheduled-end-date').value;
        const is_not_main = document.getElementById('task-is-not-main').checked;

        if ((scheduled_start_date && !scheduled_end_date) || (!scheduled_start_date && scheduled_end_date)) {
            addErrorMessageDiv.textContent = 'Both scheduled start and end dates must be provided if one is present.';
            return;
        }

        const taskData = {
            name, detail, limit_date, is_not_main,
            scheduled_start_date: scheduled_start_date || "", 
            scheduled_end_date: scheduled_end_date || ""   
        };

        try {
            const response = await fetch('/add_task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData),
            });

            if (!response.ok) {
                const err = await response.json();
                throw err;
            }
            hideAddTaskPopup();
            addTaskForm.reset();
            fetchAndRenderActiveTasks(); 
        } catch (error) {
            console.error('Error adding task:', error);
            addErrorMessageDiv.textContent = `Error: ${error.error || 'An unexpected error occurred.'}`;
        }
    });

    // --- Form Submission for Editing Task ---
    editTaskForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        editErrorMessageDiv.textContent = '';

        const taskId = editTaskIdInput.value;
        const name = document.getElementById('edit-task-name').value;
        const detail = document.getElementById('edit-task-detail').value;
        const limit_date = document.getElementById('edit-task-limit-date').value;
        let scheduled_start_date = document.getElementById('edit-task-scheduled-start-date').value;
        let scheduled_end_date = document.getElementById('edit-task-scheduled-end-date').value;
        // is_not_main and status are not directly editable in this form for now

        if ((scheduled_start_date && !scheduled_end_date) || (!scheduled_start_date && scheduled_end_date)) {
            editErrorMessageDiv.textContent = 'Both scheduled start and end dates must be provided if one is present.';
            return;
        }
        
        const taskData = {
            name, detail, limit_date,
            scheduled_start_date: scheduled_start_date || "",
            scheduled_end_date: scheduled_end_date || ""
        };

        try {
            const response = await fetch(`/update_task/${taskId}`, {
                method: 'POST', // As defined in Python backend
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData),
            });

            if (!response.ok) {
                const err = await response.json();
                throw err;
            }
            hideEditTaskPopup();
            fetchAndRenderActiveTasks();
            // Optionally, show a success notification here
            // alert('Task updated successfully!'); 
        } catch (error) {
            console.error('Error updating task:', error);
            editErrorMessageDiv.textContent = `Error: ${error.error || 'An unexpected error occurred.'}`;
        }
    });

    // Initial load of tasks
    fetchAndRenderActiveTasks();
});
