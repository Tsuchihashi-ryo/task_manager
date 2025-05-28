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
    const ganttTarget = document.getElementById('gantt-target');


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
    let sortableInstance = null; 
    let currentGanttInstance = null; 
    const ganttViewModes = ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month']; // Order for zooming

    // --- Helper Functions ---

    /**
     * Formats an ISO datetime string (or null) to a string suitable for date input (YYYY-MM-DD).
     * @param {string|null} isoString - The ISO datetime string from the backend.
     * @returns {string} Formatted string or empty string if input is null/empty.
     */
    function formatDateTimeForInput(isoString) {
        if (!isoString) return "";
        // Original: isoString.substring(0, 16) for datetime-local (YYYY-MM-DDTHH:MM)
        // Changed to 0, 10 for date (YYYY-MM-DD)
        return isoString.substring(0, 10); // Changed from 16 to 10
    }

    // --- Popup Management ---
    function showPopup(popupElement, errorDivElement, formElement) {
        if (popupElement) popupElement.style.display = 'block';
        if (popupOverlay) popupOverlay.style.display = 'block';
        if (errorDivElement) errorDivElement.textContent = ''; 
        if (formElement) formElement.reset(); 
    }

    function hidePopup(popupElement) {
        if (popupElement) popupElement.style.display = 'none';
        if (addTaskPopup.style.display === 'none' &&
            editTaskPopup.style.display === 'none' &&
            deleteConfirmPopup.style.display === 'none') {
            if (popupOverlay) popupOverlay.style.display = 'none';
        }
    }

    function showAddTaskPopup() {
        showPopup(addTaskPopup, addErrorMessageDiv, addTaskForm);
    }
    function hideAddTaskPopup() {
        hidePopup(addTaskPopup);
    }
    
    function updateEditActionButtonsState() {
        if (!currentEditTaskDetails) return;
        const status = currentEditTaskDetails.status;
        startTaskBtn.disabled = status === 'doing' || status === 'completed';
        endTaskBtn.disabled = status === 'completed';
        deleteFromEditBtn.disabled = status === 'deleted';
    }
    
    function showEditTaskPopupUI(taskDetails) {
        currentEditTaskDetails = taskDetails; 
        editTaskIdInput.value = currentEditTaskDetails.id;
        document.getElementById('edit-task-name').value = currentEditTaskDetails.name;
        document.getElementById('edit-task-detail').value = currentEditTaskDetails.detail || "";
        document.getElementById('edit-task-limit-date').value = formatDateTimeForInput(currentEditTaskDetails.limit_date);
        document.getElementById('edit-task-scheduled-start-date').value = formatDateTimeForInput(currentEditTaskDetails.scheduled_start_date);
        document.getElementById('edit-task-scheduled-end-date').value = formatDateTimeForInput(currentEditTaskDetails.scheduled_end_date);
        
        showPopup(editTaskPopup, editErrorMessageDiv, null); 
        updateEditActionButtonsState(); 
    }
    function hideEditTaskPopup() {
        hidePopup(editTaskPopup);
        currentEditTaskDetails = null; 
    }
    
    function showDeleteConfirmPopup(taskId) {
        deleteTaskIdConfirmInput.value = taskId;
        hideEditTaskPopup(); 
        showPopup(deleteConfirmPopup, deleteConfirmErrorMessageDiv, deleteConfirmPopup.querySelector('form'));
    }
    function hideDeleteConfirmPopup() {
        hidePopup(deleteConfirmPopup);
    }
    // --- End Popup Management ---

    // --- Task Rendering Functions ---
    function renderTasks(tasks) {
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
        
        const existingNoTasksMessage = taskListArea.querySelector('p');
        if (existingNoTasksMessage) {
            existingNoTasksMessage.remove();
        }

        if (!tasks || tasks.length === 0) {
            const noTasksMessage = document.createElement('p');
            noTasksMessage.textContent = 'No active tasks.';
            taskListArea.appendChild(noTasksMessage); 
            return;
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
            // If using type="date", .toLocaleDateString() is more appropriate here
            limitDateDiv.textContent = `Limit: ${task.limit_date ? new Date(task.limit_date).toLocaleDateString() : 'N/A'}`; 
            
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
                showEditTaskPopupWithDetails(taskId);
            });
            ul.appendChild(li);
        });
    }

    function renderGraphicalGantt(tasks) {
        ganttTarget.innerHTML = ''; 
        currentGanttInstance = null; // Clear previous instance reference

        const filteredTasks = tasks.filter(task => task.scheduled_start_date && task.scheduled_end_date);

        if (filteredTasks.length === 0) {
            ganttTarget.innerHTML = '<p>No tasks with scheduled dates to display in Gantt chart.</p>';
            return;
        }

        const ganttTasks = filteredTasks.map(task => {
            // Ensure dates are only YYYY-MM-DD for Frappe Gantt
            const startDate = task.scheduled_start_date.split('T')[0];
            const endDate = task.scheduled_end_date.split('T')[0];
            
            let progress = 0;
            if (task.status === 'completed' || task.actual_end_date) {
                progress = 100;
            } else if (task.status === 'doing' || task.actual_start_date) {
                progress = 50; 
            }

            return {
                id: String(task.id), 
                name: task.name,
                start: startDate,
                end: endDate,
                progress: progress,
                dependencies: '' 
            };
        });

        // eslint-disable-next-line no-undef
        currentGanttInstance = new Gantt("#gantt-target", ganttTasks, {
            header_height: 50,
            column_width: 30, 
            step: 24, 
            view_modes: ganttViewModes, // Use the defined array
            bar_height: 20,
            bar_corner_radius: 3,
            arrow_curve: 5,
            padding: 18,
            view_mode: 'Week', 
            date_format: 'YYYY-MM-DD',
            custom_popup_html: null, 
            on_click: function (task) {
                showEditTaskPopupWithDetails(task.id);
            },
        });

        // Add wheel event listener for zoom functionality if not already added
        // A simple check to prevent adding multiple listeners if this function could be re-called
        // without the target element being completely replaced.
        if (ganttTarget && !ganttTarget.dataset.wheelListenerAdded) {
            ganttTarget.addEventListener('wheel', function(event) {
                if (event.ctrlKey && currentGanttInstance) {
                    event.preventDefault();
    
                    const currentViewMode = currentGanttInstance.options.view_mode; 
                    let currentIndex = ganttViewModes.indexOf(currentViewMode);
    
                    if (currentIndex === -1) { 
                        console.warn("Current Gantt view mode not in predefined list. Resetting to default.");
                        // Attempt to find a similar mode or default to 'Week'
                        const lowerCaseModes = ganttViewModes.map(m => m.toLowerCase());
                        const currentLower = currentViewMode.toLowerCase();
                        currentIndex = lowerCaseModes.indexOf(currentLower);
                        if(currentIndex === -1) currentIndex = ganttViewModes.indexOf('Week'); // Default if still not found
                        if(currentIndex === -1) currentIndex = 2; // Absolute fallback to Day if Week is also missing
                    }
    
                    if (event.deltaY < 0) { // Scrolling up (zoom in)
                        currentIndex--;
                    } else { // Scrolling down (zoom out)
                        currentIndex++;
                    }
    
                    // Clamp index to array bounds
                    if (currentIndex < 0) {
                        currentIndex = 0;
                    } else if (currentIndex >= ganttViewModes.length) {
                        currentIndex = ganttViewModes.length - 1;
                    }
    
                    const newViewMode = ganttViewModes[currentIndex];
                    if (newViewMode && newViewMode !== currentGanttInstance.options.view_mode) {
                        currentGanttInstance.change_view_mode(newViewMode);
                    }
                }
            });
            ganttTarget.dataset.wheelListenerAdded = 'true';
        }
    }
    
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
            restoreBtn.className = 'restore-btn'; 
            restoreBtn.dataset.taskId = task.id;
            restoreBtn.textContent = 'Restore';
            
            li.appendChild(textSpan);
            li.appendChild(restoreBtn);
            ul.appendChild(li);
        });
        completedTasksListArea.appendChild(ul);
    }

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
            restoreBtn.className = 'restore-btn'; 
            restoreBtn.dataset.taskId = task.id;
            restoreBtn.textContent = 'Restore';

            li.appendChild(textSpan);
            li.appendChild(restoreBtn);
            ul.appendChild(li);
        });
        deletedTasksListArea.appendChild(ul);
    }

    // --- API Call and Data Handling Functions ---
    async function showEditTaskPopupWithDetails(taskId) {
        editErrorMessageDiv.textContent = ''; 
        try {
            const response = await fetch(`/task/${taskId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const taskDetails = await response.json();
            showEditTaskPopupUI(taskDetails); 
        } catch (error) {
            console.error('Error fetching task details for popup:', error);
            alert(`Error fetching task details: ${error.message}`);
        }
    }

    async function fetchAndRenderActiveTasks(sortBy = 'display_order') {
        try {
            const response = await fetch(`/get_tasks?sort_by=${sortBy}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const tasks = await response.json();
            renderTasks(tasks); 
            renderGraphicalGantt(tasks);

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

    // --- Form Submission Handlers ---
    addTaskForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        addErrorMessageDiv.textContent = ''; 

        const name = document.getElementById('task-name').value;
        const detail = document.getElementById('task-detail').value;
        const limit_date = document.getElementById('task-limit-date').value;
        let scheduled_start_date = document.getElementById('task-scheduled-start-date').value;
        let scheduled_end_date = document.getElementById('task-scheduled-end-date').value;

        // Backend expects either both or none for scheduled dates, check here too
        if ((scheduled_start_date && !scheduled_end_date) || (!scheduled_start_date && scheduled_end_date)) {
            addErrorMessageDiv.textContent = 'Both scheduled start and end dates must be provided if one is present.';
            return;
        }

        const is_not_main = document.getElementById('task-is-not-main').checked;

        const taskData = {
            name, detail, limit_date, is_not_main,
            scheduled_start_date: scheduled_start_date || null, // Send null if empty string - backend expects None for optional
            scheduled_end_date: scheduled_end_date || null // Send null if empty string
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

    editTaskForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        editErrorMessageDiv.textContent = '';

        const taskId = editTaskIdInput.value;
        const name = document.getElementById('edit-task-name').value;
        const detail = document.getElementById('edit-task-detail').value;
        const limit_date = document.getElementById('edit-task-limit-date').value;
        let scheduled_start_date = document.getElementById('edit-task-scheduled-start-date').value;
        let scheduled_end_date = document.getElementById('edit-task-scheduled-end-date').value;

        // Backend expects either both or none for scheduled dates, check here too
        if ((scheduled_start_date && !scheduled_end_date) || (!scheduled_start_date && scheduled_end_date)) {
            editErrorMessageDiv.textContent = 'Both scheduled start and end dates must be provided if one is present.';
            return;
        }
        
        const taskData = {
            name, detail, limit_date,
            scheduled_start_date: scheduled_start_date || null, // Send null if empty string
            scheduled_end_date: scheduled_end_date || null      // Send null if empty string
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
            hideDeleteConfirmPopup(); 
            fetchAndRenderActiveTasks(); 
            fetchAndRenderDeletedTasks(); 
        } catch (error) {
            console.error('Error deleting task:', error);
            deleteConfirmErrorMessageDiv.textContent = `Error: ${error.error || 'An unexpected error occurred.'}`;
        }
    });
    
    // --- Event Delegation for Restore Buttons ---
    async function handleRestoreTask(event) {
        if (event.target.classList.contains('restore-btn')) {
            const taskId = event.target.dataset.taskId;
            if (!taskId) return;

            try {
                const response = await fetch(`/restore_task/${taskId}`, { method: 'POST' });
                if (!response.ok) {
                    const err = await response.json();
                    throw err; 
                }
                const data = await response.json();
                console.log(data.message); 

                fetchAndRenderActiveTasks();
                fetchAndRenderCompletedTasks();
                fetchAndRenderDeletedTasks();
            } catch (error) {
                console.error('Error restoring task:', error);
                alert(`Error restoring task: ${error.error || 'An unexpected error occurred.'}`);
            }
        }
    }
    
    // --- Event Listeners for UI interactions ---
    addTaskBtn.addEventListener('click', showAddTaskPopup);
    cancelAddTaskBtn.addEventListener('click', hideAddTaskPopup);
    cancelEditTaskBtn.addEventListener('click', hideEditTaskPopup);
    cancelDeleteConfirmBtn.addEventListener('click', hideDeleteConfirmPopup);
    
    deleteFromEditBtn.addEventListener('click', () => {
        const taskId = editTaskIdInput.value;
        if (taskId) {
            let userConfirmed = confirm("Are you sure you want to delete this task?"); // Basic confirmation. Replaced with popup later.
            if(userConfirmed) {
                showDeleteConfirmPopup(taskId);
            }
        } else {
            console.error("Task ID not found in edit form for deletion.");
        }
    });
    
    sortByLimitBtn.addEventListener('click', () => {
        fetchAndRenderActiveTasks('limit_date');
    });

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

            hideEditTaskPopup(); 
            fetchAndRenderActiveTasks(); 
            fetchAndRenderCompletedTasks(); 
        } catch (error) {
            console.error('Error ending task:', error);
            editErrorMessageDiv.textContent = `Error: ${error.error || 'An unexpected error occurred.'}`;
        }
    });
    
    completedTasksListArea.addEventListener('click', handleRestoreTask);
    deletedTasksListArea.addEventListener('click', handleRestoreTask);
    
    if (popupOverlay) {
        popupOverlay.addEventListener('click', () => {
            hideAddTaskPopup();
            hideEditTaskPopup();
            hideDeleteConfirmPopup();
        });
    }

    // --- Initial Data Load ---
    fetchAndRenderActiveTasks();
    fetchAndRenderCompletedTasks();
    fetchAndRenderDeletedTasks();
});
