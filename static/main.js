// Wait for the DOM to be fully loaded before running scripts
document.addEventListener('DOMContentLoaded', function() {
    // --- Global DOM Element References ---
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
    const sortByLimitBtn = document.getElementById('sort-by-limit-btn');

    // Gantt Chart Area
    const ganttChartList = document.getElementById('simple-gantt-list');

    // Delete Confirmation Popup Elements
    const deleteConfirmPopup = document.getElementById('delete-confirm-popup');
    const cancelDeleteConfirmBtn = document.getElementById('cancel-delete-confirm-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const deleteReasonInput = document.getElementById('delete_reason_input');
    const deleteTaskIdConfirmInput = document.getElementById('delete-task-id-confirm');
    const deleteConfirmErrorMessageDiv = document.getElementById('delete-confirm-error-message');

    // List areas for completed and deleted tasks
    const completedTasksListArea = document.getElementById('completed-tasks-list');
    const deletedTasksListArea = document.getElementById('deleted-tasks-list');

    // --- Global State Variables ---
    let currentEditTaskDetails = null; // Stores the full details of the task being edited
    let sortableInstance = null;      // To keep track of the SortableJS instance for active tasks

    // --- Helper Functions ---

    /**
     * Formats an ISO datetime string (or null) to a string suitable for datetime-local input.
     * Example: "2023-10-04T10:30:00" -> "2023-10-04T10:30"
     * @param {string|null} isoString - The ISO datetime string from the backend.
     * @returns {string} Formatted string or empty string if input is null/empty.
     */
    function formatDateTimeForInput(isoString) {
        if (!isoString) return "";
        return isoString.substring(0, 16);
    }

    // --- Popup Management ---
    // Generic function to show a popup and the overlay
    function showPopup(popupElement, errorDivElement, formElement) {
        if (popupElement) popupElement.style.display = 'block';
        if (popupOverlay) popupOverlay.style.display = 'block';
        if (errorDivElement) errorDivElement.textContent = ''; // Clear previous errors
        if (formElement) formElement.reset(); // Reset form if provided
    }

    // Generic function to hide a popup
    function hidePopup(popupElement) {
        if (popupElement) popupElement.style.display = 'none';
        // Check if any other popups are open before hiding overlay
        if (addTaskPopup.style.display === 'none' &&
            editTaskPopup.style.display === 'none' &&
            deleteConfirmPopup.style.display === 'none') {
            if (popupOverlay) popupOverlay.style.display = 'none';
        }
    }

    // Add Task Popup
    function showAddTaskPopup() {
        showPopup(addTaskPopup, addErrorMessageDiv, addTaskForm);
    }
    function hideAddTaskPopup() {
        hidePopup(addTaskPopup);
    }
    addTaskBtn.addEventListener('click', showAddTaskPopup);
    cancelAddTaskBtn.addEventListener('click', hideAddTaskPopup);

    // Edit Task Popup
    function updateEditActionButtonsState() {
        /**
         * Updates the enabled/disabled state of action buttons (Start, End, Delete)
         * in the Edit Task popup based on the current task's status.
         */
        if (!currentEditTaskDetails) return;
        const status = currentEditTaskDetails.status;
        startTaskBtn.disabled = status === 'doing' || status === 'completed';
        endTaskBtn.disabled = status === 'completed';
        deleteFromEditBtn.disabled = status === 'deleted';
    }
    
    function showEditTaskPopupUI(taskDetails) {
        /**
         * Populates and shows the Edit Task popup.
         * Assumes taskDetails are already fetched and stored in currentEditTaskDetails.
         */
        currentEditTaskDetails = taskDetails; 
        // Populate form fields before showing popup
        editTaskIdInput.value = currentEditTaskDetails.id;
        document.getElementById('edit-task-name').value = currentEditTaskDetails.name;
        document.getElementById('edit-task-detail').value = currentEditTaskDetails.detail || "";
        document.getElementById('edit-task-limit-date').value = formatDateTimeForInput(currentEditTaskDetails.limit_date);
        document.getElementById('edit-task-scheduled-start-date').value = formatDateTimeForInput(currentEditTaskDetails.scheduled_start_date);
        document.getElementById('edit-task-scheduled-end-date').value = formatDateTimeForInput(currentEditTaskDetails.scheduled_end_date);
        
        showPopup(editTaskPopup, editErrorMessageDiv, null); // Don't reset form, it's populated
        updateEditActionButtonsState(); 
    }
    function hideEditTaskPopup() {
        hidePopup(editTaskPopup);
        currentEditTaskDetails = null; // Clear current task details when popup is hidden
    }
    cancelEditTaskBtn.addEventListener('click', hideEditTaskPopup);

    // Delete Confirmation Popup
    function showDeleteConfirmPopup(taskId) {
        deleteTaskIdConfirmInput.value = taskId;
        hideEditTaskPopup(); // Hide edit popup first, then show delete confirm
        showPopup(deleteConfirmPopup, deleteConfirmErrorMessageDiv, deleteConfirmPopup.querySelector('form'));
    }
    function hideDeleteConfirmPopup() {
        hidePopup(deleteConfirmPopup);
    }
    cancelDeleteConfirmBtn.addEventListener('click', hideDeleteConfirmPopup);

    // Overlay click handler to close any open popup
    if (popupOverlay) {
        popupOverlay.addEventListener('click', () => {
            hideAddTaskPopup();
            hideEditTaskPopup();
            hideDeleteConfirmPopup();
        });
    }
    // --- End Popup Management ---

    // --- Event Listeners for Buttons within Popups or Main UI ---

    // Listener for "Delete" button in Edit Popup
    deleteFromEditBtn.addEventListener('click', () => {
        const taskId = editTaskIdInput.value;
        if (taskId) {
            showDeleteConfirmPopup(taskId);
        } else {
            console.error("Task ID not found in edit form for deletion.");
        }
    });

    // --- Task Rendering Functions ---

    function renderTasks(tasks) {
        /**
         * Renders the list of active tasks in the '#task-list-area'.
         * Sets up click listeners on each task item to open the edit popup.
         */
        let ul = document.getElementById('active-tasks-ul');
        if (!ul) { 
            ul = document.createElement('ul');
            ul.id = 'active-tasks-ul';
            ul.className = 'task-list';
            taskListArea.innerHTML = ''; 
            taskListArea.appendChild(ul);
        } else {
            ul.innerHTML = ''; 
        }
        
        if (!tasks || tasks.length === 0) {
            const p = taskListArea.querySelector('p');
            if (p) p.remove(); // Remove old "no tasks" message if any
            const noTasksMessage = document.createElement('p');
            noTasksMessage.textContent = 'No active tasks.';
            taskListArea.appendChild(noTasksMessage);
            return;
        } else {
             const p = taskListArea.querySelector('p'); // Remove "no tasks" message if it exists
             if (p) p.remove();
        }

        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'task-item';
            li.dataset.taskId = task.id; 
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
            
            li.addEventListener('click', async () => {
                const taskId = li.dataset.taskId;
                editErrorMessageDiv.textContent = ''; 
                try {
                    const response = await fetch(`/task/${taskId}`);
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                    }
                    const taskDetails = await response.json();
                    showEditTaskPopupUI(taskDetails); // Show popup with populated data
                } catch (error) {
                    console.error('Error fetching task details:', error);
                    editErrorMessageDiv.textContent = `Error: ${error.message}`; 
                }
            });
            ul.appendChild(li);
        });
    }
    
    // --- API Call and Data Handling Functions ---

    /**
     * Fetches active tasks from the server and renders them.
     * @param {string} sortBy - The criteria to sort tasks by ('display_order' or 'limit_date').
     */
    async function fetchAndRenderActiveTasks(sortBy = 'display_order') {
        try {
            const response = await fetch(`/get_tasks?sort_by=${sortBy}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const tasks = await response.json();
            renderTasks(tasks); 
            renderSimpleGantt(tasks);

            const activeTasksULElement = document.getElementById('active-tasks-ul');
            if (activeTasksULElement) {
                if (sortableInstance) {
                    sortableInstance.destroy(); 
                }
                sortableInstance = new Sortable(activeTasksULElement, {
                    animation: 150,
                    ghostClass: 'sortable-ghost', 
                    chosenClass: 'sortable-chosen', 
                    dragClass: 'sortable-drag', 
                    onEnd: async function (evt) {
                        const parentEl = evt.to;  
                        const orderedIds = Array.from(parentEl.children).map(child => child.dataset.taskId);
                        
                        try {
                            const sortResponse = await fetch('/update_task_order', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ordered_ids: orderedIds }),
                            });
                            if (!sortResponse.ok) {
                                const err = await sortResponse.json();
                                console.error('Failed to update task order:', err.error);
                                fetchAndRenderActiveTasks(); 
                                alert(`Error updating task order: ${err.error || 'Server error'}`);
                            } else {
                                console.log('Task order updated successfully.');
                                if (sortBy !== 'display_order') {
                                     fetchAndRenderActiveTasks('display_order');
                                }
                            }
                        } catch (error) {
                            console.error('Error sending task order:', error);
                            fetchAndRenderActiveTasks(); 
                            alert('Error sending task order to server.');
                        }
                    },
                });
            }

        } catch (error) {
            console.error('Error fetching tasks:', error);
            taskListArea.innerHTML = `<p style="color: red;">Error loading tasks: ${error.message}</p>`;
        }
    }

    // Event Listener for "Sort by Limit" button
    sortByLimitBtn.addEventListener('click', () => {
        fetchAndRenderActiveTasks('limit_date');
    });

    // --- Form Submission Handlers ---

    /**
     * Handles the submission of the "Add Task" form.
     * Sends task data to the backend and refreshes the active task list.
     */
    addTaskForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        addErrorMessageDiv.textContent = ''; 

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

    /**
     * Handles the submission of the "Edit Task" form (Save button).
     * Sends updated task data to the backend and refreshes active tasks.
     */
    editTaskForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        editErrorMessageDiv.textContent = '';

        const taskId = editTaskIdInput.value;
        const name = document.getElementById('edit-task-name').value;
        const detail = document.getElementById('edit-task-detail').value;
        const limit_date = document.getElementById('edit-task-limit-date').value;
        let scheduled_start_date = document.getElementById('edit-task-scheduled-start-date').value;
        let scheduled_end_date = document.getElementById('edit-task-scheduled-end-date').value;

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
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData),
            });

            if (!response.ok) {
                const err = await response.json();
                throw err;
            }
            hideEditTaskPopup();
            fetchAndRenderActiveTasks();
        } catch (error) {
            console.error('Error updating task:', error);
            editErrorMessageDiv.textContent = `Error: ${error.error || 'An unexpected error occurred.'}`;
        }
    });

    /**
     * Handles the confirmation of task deletion.
     * Sends delete request to backend and refreshes relevant task lists.
     */
    confirmDeleteBtn.addEventListener('click', async () => {
        const taskId = deleteTaskIdConfirmInput.value;
        const delete_reason = deleteReasonInput.value;
        deleteConfirmErrorMessageDiv.textContent = '';

        try {
            const response = await fetch(`/delete_task/${taskId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delete_reason }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw err;
            }
            hideDeleteConfirmPopup(); // Close popup first
            fetchAndRenderActiveTasks(); // Refresh active list
            fetchAndRenderDeletedTasks(); // Refresh deleted list
        } catch (error) {
            console.error('Error deleting task:', error);
            deleteConfirmErrorMessageDiv.textContent = `Error: ${error.error || 'An unexpected error occurred.'}`;
        }
    });

    /**
     * Handles the "Start Task" action from the Edit Task popup.
     * Updates task status to 'doing' and refreshes UI.
     */
    startTaskBtn.addEventListener('click', async () => {
        const taskId = editTaskIdInput.value;
        editErrorMessageDiv.textContent = '';
        try {
            const response = await fetch(`/start_task/${taskId}`, { method: 'POST' });
            if (!response.ok) {
                const err = await response.json();
                throw err;
            }
            const data = await response.json();
            if (currentEditTaskDetails && currentEditTaskDetails.id == taskId) {
                currentEditTaskDetails.actual_start_date = data.actual_start_date;
                currentEditTaskDetails.status = data.status;
                updateEditActionButtonsState(); 
            }
            fetchAndRenderActiveTasks(); 
        } catch (error) {
            console.error('Error starting task:', error);
            editErrorMessageDiv.textContent = `Error: ${error.error || 'An unexpected error occurred.'}`;
        }
    });

    /**
     * Handles the "End Task" action from the Edit Task popup.
     * Updates task status to 'completed', closes popup, and refreshes UI.
     */
    endTaskBtn.addEventListener('click', async () => {
        const taskId = editTaskIdInput.value;
        editErrorMessageDiv.textContent = '';
        try {
            const response = await fetch(`/end_task/${taskId}`, { method: 'POST' });
            if (!response.ok) {
                const err = await response.json();
                throw err;
            }
            const data = await response.json();
            
            if (currentEditTaskDetails && currentEditTaskDetails.id == taskId) {
                 currentEditTaskDetails.actual_start_date = data.actual_start_date; 
                 currentEditTaskDetails.actual_end_date = data.actual_end_date;
                 currentEditTaskDetails.status = data.status;
            }

            hideEditTaskPopup(); // Close popup as task is now completed
            fetchAndRenderActiveTasks(); // Refresh active list (task should disappear)
            fetchAndRenderCompletedTasks(); // Refresh completed list
        } catch (error) {
            console.error('Error ending task:', error);
            editErrorMessageDiv.textContent = `Error: ${error.error || 'An unexpected error occurred.'}`;
        }
    });
    
    // --- Rendering Functions for Different Task Categories ---

    /**
     * Renders a simple textual Gantt chart for tasks with scheduled dates.
     */
    function renderSimpleGantt(tasks) {
        ganttChartList.innerHTML = ''; 
        const scheduledTasks = tasks.filter(task => task.scheduled_start_date && task.scheduled_end_date);
        if (scheduledTasks.length === 0) {
            ganttChartList.innerHTML = '<li>No tasks with scheduled dates for Gantt view.</li>';
            return;
        }
        scheduledTasks.forEach(task => {
            const li = document.createElement('li');
            const startDate = new Date(task.scheduled_start_date).toLocaleDateString();
            const endDate = new Date(task.scheduled_end_date).toLocaleDateString();
            li.textContent = `${task.name}: [${startDate}] to [${endDate}]`;
            ganttChartList.appendChild(li);
        });
    }
    
    /**
     * Renders the list of completed tasks in '#completed-tasks-list'.
     */
    function renderCompletedTasks(tasks) {
        completedTasksListArea.innerHTML = ''; 
        if (!tasks || tasks.length === 0) {
            completedTasksListArea.innerHTML = '<p>No completed tasks.</p>';
            return;
        }
        const ul = document.createElement('ul');
        ul.className = 'task-list-condensed';
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'task-item-condensed';
            
            const textSpan = document.createElement('span');
            textSpan.textContent = `${task.name} (Completed: ${new Date(task.actual_end_date).toLocaleDateString()})`;
            
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'restore-btn'; // Class for styling and event delegation
            restoreBtn.dataset.taskId = task.id;
            restoreBtn.textContent = 'Restore';
            
            li.appendChild(textSpan);
            li.appendChild(restoreBtn);
            ul.appendChild(li);
        });
        completedTasksListArea.appendChild(ul);
    }

    /**
     * Fetches completed tasks from the server and renders them.
     */
    async function fetchAndRenderCompletedTasks() {
        try {
            const response = await fetch('/get_completed_tasks');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const tasks = await response.json();
            renderCompletedTasks(tasks);
        } catch (error) {
            console.error('Error fetching completed tasks:', error);
            completedTasksListArea.innerHTML = `<p style="color: red;">Error loading completed tasks: ${error.message}</p>`;
        }
    }

    /**
     * Renders the list of deleted tasks in '#deleted-tasks-list'.
     */
    function renderDeletedTasks(tasks) {
        deletedTasksListArea.innerHTML = ''; 
        if (!tasks || tasks.length === 0) {
            deletedTasksListArea.innerHTML = '<p>No deleted tasks.</p>';
            return;
        }
        const ul = document.createElement('ul');
        ul.className = 'task-list-condensed';
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'task-item-condensed';
            
            const textSpan = document.createElement('span');
            let text = `${task.name} (Deleted: ${new Date(task.updated_at).toLocaleDateString()})`;
            if (task.delete_reason) {
                text += ` - Reason: ${task.delete_reason}`;
            }
            textSpan.textContent = text;

            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'restore-btn'; // Class for styling and event delegation
            restoreBtn.dataset.taskId = task.id;
            restoreBtn.textContent = 'Restore';

            li.appendChild(textSpan);
            li.appendChild(restoreBtn);
            ul.appendChild(li);
        });
        deletedTasksListArea.appendChild(ul);
    }

    /**
     * Fetches deleted tasks from the server and renders them.
     */
    async function fetchAndRenderDeletedTasks() {
        try {
            const response = await fetch('/get_deleted_tasks');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const tasks = await response.json();
            renderDeletedTasks(tasks);
        } catch (error) {
            console.error('Error fetching deleted tasks:', error);
            deletedTasksListArea.innerHTML = `<p style="color: red;">Error loading deleted tasks: ${error.message}</p>`;
        }
    }

    // --- Event Delegation for Restore Buttons ---
    /**
     * Handles click events on restore buttons within completed or deleted task lists.
     * Uses event delegation.
     * @param {Event} event - The click event.
     */
    async function handleRestoreTask(event) {
        if (event.target.classList.contains('restore-btn')) {
            const taskId = event.target.dataset.taskId;
            if (!taskId) return;

            try {
                const response = await fetch(`/restore_task/${taskId}`, { method: 'POST' });
                if (!response.ok) {
                    const err = await response.json();
                    throw err; // Throw to be caught by catch block
                }
                const data = await response.json();
                console.log(data.message); // Log success
                // alert(data.message); // Optional: provide user feedback

                // Refresh all relevant lists to reflect the change
                fetchAndRenderActiveTasks();
                fetchAndRenderCompletedTasks();
                fetchAndRenderDeletedTasks();
            } catch (error) {
                console.error('Error restoring task:', error);
                // Display error to the user, e.g., via an alert or a dedicated status message area
                alert(`Error restoring task: ${error.error || 'An unexpected error occurred.'}`);
            }
        }
    }

    // Attach event listeners for restore buttons using delegation
    completedTasksListArea.addEventListener('click', handleRestoreTask);
    deletedTasksListArea.addEventListener('click', handleRestoreTask);

    // --- Initial Data Load ---
    // Fetch and render all categories of tasks when the page loads.
    fetchAndRenderActiveTasks();
    fetchAndRenderCompletedTasks();
    fetchAndRenderDeletedTasks();
});
