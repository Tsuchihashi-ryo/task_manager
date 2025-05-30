// Wait for the DOM to be fully loaded before running scripts
document.addEventListener('DOMContentLoaded', function() {
    // --- Global DOM Element References ---
    const addTaskBtn = document.getElementById('add-new-task-btn');
    const addTaskPopup = document.getElementById('add-task-popup');
    const cancelAddTaskBtn = document.getElementById('cancel-add-task-btn');
    const addTaskForm = document.getElementById('add-task-form');
    // Add Task specific checkbox
    const taskIsNotMainCheckbox = document.getElementById('task-is-not-main'); 
    const popupOverlay = document.getElementById('popup-overlay'); // Shared overlay
    const addErrorMessageDiv = document.getElementById('add-task-error-message');
    const taskListArea = document.getElementById('task-list-area');

    // Edit Task Popup Elements
    const editTaskPopup = document.getElementById('edit-task-popup');
    const editTaskForm = document.getElementById('edit-task-form'); 
    const cancelEditTaskBtn = document.getElementById('cancel-edit-task-btn');
    const editErrorMessageDiv = document.getElementById('edit-task-error-message');
    const editTaskIdInput = document.getElementById('edit-task-id'); 
    const editTaskIsNotMainCheckbox = document.getElementById('edit-task-is-not-main'); 
    const deleteFromEditBtn = document.getElementById('delete-task-btn'); 
    const startTaskBtn = document.getElementById('start-task-btn'); 
    const endTaskBtn = document.getElementById('end-task-btn');
    const sortByLimitBtn = document.getElementById('sort-by-limit-btn');

    // Gantt Chart Area
    const ganttTarget = document.getElementById('gantt-target');

    // Task Detail View Popup Elements
    const viewTaskDetailsPopup = document.getElementById('view-task-details-popup');
    const closeViewTaskDetailsBtn = document.getElementById('close-view-task-details-btn');
    const restoreFromViewBtn = document.getElementById('restore-from-view-btn'); // Restore button in detail view


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
    const ganttViewModes = ['Quarter Day', '	Half Day', 'Day', 'Week', 'Month']; // Order for zooming

    // --- Helper Functions ---

    /**
     * Formats an ISO datetime string (or null) to a string suitable for date input (YYYY-MM-DD).
     * @param {string|null} isoString - The ISO datetime string from the backend.
     * @returns  Formatted string or empty string if input is null/empty.
     */
    function formatDateTimeForInput(isoString) {
        if (!isoString) return "";
        return isoString.substring(0, 10); 
    }

    /**
     * Formats an ISO datetime string (or null) to a human-readable format (YYYY/MM/DD HH:MM).
     * @param {string|null} isoString - The ISO datetime string from the backend.
     * @returns  Formatted string or 'N/A' if input is null/empty.
     */
    function formatDateTimeForDisplay(isoString) {
        if (!isoString) return "N/A";
        // Attempt to parse with 'T' separating date and time
        const date = new Date(isoString);
        // Check if parsing was successful and if it's a valid date
        if (isNaN(date.getTime())) {
            // Fallback for cases like 'YYYY-MM-DD' without time or 'T'
            const parts = isoString.split('-');
            if (parts.length === 3) {
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1; // Month is 0-indexed
                const day = parseInt(parts[2]);
                const fallbackDate = new Date(year, month, day);
                if (!isNaN(fallbackDate.getTime())) {
                    return fallbackDate.toLocaleDateString('ja-JP'); // Format as YYYY/MM/DD
                }
            }
            return isoString; // Return original string if all parsing attempts fail
        }
        // If it includes time information, format with time, otherwise without.
        if (isoString.includes('T') && isoString.includes(':')) {
           return date.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false // 24時間表示
             }).replace(/\//g, '/'); // "/"に統一
        } else {
            return date.toLocaleDateString('ja-JP'); // 日付のみ
        }
    }


    // --- Popup Management ---
    function showPopup(popupElement, errorDivElement, formElement) {
        if (popupElement) popupElement.classList.remove('hidden'); // Use Tailwind hidden class
        if (popupOverlay) popupOverlay.classList.remove('hidden'); // Use Tailwind hidden class
        if (errorDivElement) errorDivElement.textContent = ''; 
        if (formElement) formElement.reset(); 
    }

    function hidePopup(popupElement) {
        if (popupElement) popupElement.classList.add('hidden'); // Use Tailwind hidden class
        // Check if all popups are hidden before hiding the overlay 
        if (addTaskPopup.classList.contains('hidden') &&
            editTaskPopup.classList.contains('hidden') &&
            deleteConfirmPopup.classList.contains('hidden') &&
            viewTaskDetailsPopup.classList.contains('hidden')) { 
            if (popupOverlay) popupOverlay.classList.add('hidden'); // Use Tailwind hidden class
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
        
        // Start/Stopボタンのテキストとスタイルを切り替え
        if (status === 'doing') {
            startTaskBtn.textContent = 'Stop';
            startTaskBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
            startTaskBtn.classList.add('bg-yellow-600', 'hover:bg-yellow-700'); // Stop用
            startTaskBtn.disabled = false; // Stopは常に可能
        } else {
            startTaskBtn.textContent = 'Start';
            startTaskBtn.classList.remove('bg-yellow-600', 'hover:bg-yellow-700'); // Stop用スタイルを削除
            startTaskBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            startTaskBtn.disabled = status === 'completed'; // 完了済みはスタート不可
        }

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
        editTaskIsNotMainCheckbox.checked = currentEditTaskDetails.is_not_main; 
        
        showPopup(editTaskPopup, editErrorMessageDiv, null); 
        updateEditActionButtonsState(); 
    }
    function hideEditTaskPopup() {
        hidePopup(editTaskPopup);
        currentEditTaskDetails = null; 
    } 
    
    function showViewTaskDetailsPopupUI(taskDetails) {
        // Populate the view-only popup fields
        document.getElementById('view-task-name').textContent = taskDetails.name;
        document.getElementById('view-task-detail').textContent = taskDetails.detail || 'N/A';
        document.getElementById('view-task-limit-date').textContent = formatDateTimeForDisplay(taskDetails.limit_date);
        
        let scheduledPeriod = 'N/A';
        if (taskDetails.scheduled_start_date && taskDetails.scheduled_end_date) {
            scheduledPeriod = `${formatDateTimeForDisplay(taskDetails.scheduled_start_date)} - ${formatDateTimeForDisplay(taskDetails.scheduled_end_date)}`;
        }
        document.getElementById('view-task-scheduled-period').textContent = scheduledPeriod;

        let actualPeriod = 'N/A';
        if (taskDetails.actual_start_date && taskDetails.actual_end_date) {
            actualPeriod = `${formatDateTimeForDisplay(taskDetails.actual_start_date)} - ${formatDateTimeForDisplay(taskDetails.actual_end_date)}`;
        } else if (taskDetails.actual_start_date) {
            actualPeriod = `${formatDateTimeForDisplay(taskDetails.actual_start_date)} - (Ongoing)`;
        } else if (taskDetails.actual_end_date) { // Case for deleted tasks with only end date set by system
            actualPeriod = `(Not Started) - ${formatDateTimeForDisplay(taskDetails.actual_end_date)}`;
        }
        document.getElementById('view-task-actual-period').textContent = actualPeriod;
        
        document.getElementById('view-task-status').textContent = taskDetails.status;
        document.getElementById('view-task-is-not-main').textContent = taskDetails.is_not_main ? 'Yes' : 'No';

        const deleteReasonContainer = document.getElementById('view-task-delete-reason-container');
        if (taskDetails.status === 'deleted' && taskDetails.delete_reason) {
            deleteReasonContainer.classList.remove('hidden');
            document.getElementById('view-task-delete-reason').textContent = taskDetails.delete_reason;
        } else {
            deleteReasonContainer.classList.add('hidden');
            document.getElementById('view-task-delete-reason').textContent = '';
        }

        document.getElementById('view-task-created-at').textContent = formatDateTimeForDisplay(taskDetails.created_at);
        document.getElementById('view-task-updated-at').textContent = formatDateTimeForDisplay(taskDetails.updated_at);

        // Set taskId on the restore button for easy access during restore operation
        restoreFromViewBtn.dataset.taskId = taskDetails.id;
        // Show/hide restore button based on status
        if (taskDetails.status === 'completed' || taskDetails.status === 'deleted') {
            restoreFromViewBtn.classList.remove('hidden');
        } else {
            restoreFromViewBtn.classList.add('hidden');
        }

        showPopup(viewTaskDetailsPopup, null, null); // No error div or form to reset for view popup
    }

    function hideViewTaskDetailsPopup() {
        hidePopup(viewTaskDetailsPopup);
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
            noTasksMessage.className = 'text-gray-500 italic';
            taskListArea.appendChild(noTasksMessage);
            return;
        }

        tasks.forEach(task => { 
            const li = document.createElement('li');
            li.className = 'task-item flex items-center h-8 px-4 rounded-md bg-gray-50 hover:bg-gray-100 cursor-pointer transition-all duration-200 mb-2';
            li.dataset.taskId = task.id; 
            li.id = `task-item-${task.id}`;

            // --- 新しい日付比較とステータスに基づくスタイリングロジック ---
            const today = new Date();
            today.setHours(0, 0, 0, 0); // 今日の日付の時刻をリセット
            const limitDate = task.limit_date ? new Date(task.limit_date) : null;
            if (limitDate) {
                limitDate.setHours(0, 0, 0, 0); // 期限日の時刻をリセット
            }

            // is_not_main フラグが真の場合の特殊な色分けロジックを適用
            if (task.is_not_main) {
                // 優先順位: 期限切れ (赤) > 期限間近 (紫) > 通常 (青)
                if (limitDate && today.getTime() > limitDate.getTime()) {
                    li.classList.add('task-is-not-main-overdue'); // 赤
                } else if (limitDate) {
                    const oneWeekBeforeLimit = new Date(limitDate);
                    oneWeekBeforeLimit.setDate(limitDate.getDate() - 7);
                    oneWeekBeforeLimit.setHours(0, 0, 0, 0);
                    if (today.getTime() >= oneWeekBeforeLimit.getTime()) {
                        li.classList.add('task-is-not-main-pending'); // 紫
                    } else {
                        li.classList.add('task-is-not-main-default'); // 青
                    }
                } else {
                    li.classList.add('task-is-not-main-default'); // limit_dateがない場合も青
                }
            } else {
                // is_not_main フラグが偽の場合の既存の色分けロジック
                // スタイルの優先順位: 赤 > オレンジ
                // 1. Limit day を過ぎている場合 (赤色を優先)
                if (limitDate && today.getTime() > limitDate.getTime()) {
                    li.classList.add('task-status-overdue'); // 赤色
                } 
                // 2. Limit day が1週間以内の場合 (オレンジ色を次点優先)
                else if (limitDate) {
                    const oneWeekBeforeLimit = new Date(limitDate);
                    oneWeekBeforeLimit.setDate(limitDate.getDate() - 7);
                    oneWeekBeforeLimit.setHours(0, 0, 0, 0);
                    
                    if (today.getTime() >= oneWeekBeforeLimit.getTime()) { // 今日が1週間前から期限日の間
                        li.classList.add('task-status-pending'); // オレンジ色
                    }
                }
                // (通常時のデフォルトは Tailwind の bg-gray-50 なので、明示的なクラス追加は不要)
            }
            
            // Start中 (doing) のタスク (緑色の太枠線) - is_not_main の色付けと独立して適用
            if (task.status === 'doing') {
                li.classList.add('task-status-doing-border'); // 緑色の枠線用クラス
            }

            const nameDiv = document.createElement('div');
            nameDiv.className = 'task-name font-bold flex-grow truncate'; 
            nameDiv.textContent = task.name;
            if (task.is_not_main) {
                nameDiv.classList.add('text-gray-600'); 
            }

            const limitDateDiv = document.createElement('div');
            limitDateDiv.className = 'task-limit-date hidden'; 
            limitDateDiv.textContent = `Limit: ${task.limit_date ? new Date(task.limit_date).toLocaleDateString() : 'N/A'}`; 
            
            const scheduledDatesDiv = document.createElement('div');
            scheduledDatesDiv.className = 'task-scheduled-dates hidden'; 
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
        console.log("renderGraphicalGantt called.");
        ganttTarget.innerHTML = ''; 
        currentGanttInstance = null; 
        
        // Calculate dates for dummy tasks to control the Gantt chart display range
        const today = new Date();
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(today.getDate() - 2); // Today - 2 days
        twoDaysAgo.setHours(0,0,0,0); // Avoid time affecting date calculation

        const threeMonthsLater = new Date(today);
        threeMonthsLater.setMonth(today.getMonth() + 3); // Today + 3 months
        threeMonthsLater.setHours(0,0,0,0); // Avoid time affecting date calculation

        // Helper to format date for Frappe Gantt's 'YYYY-MM-DD' requirement
        const formatDateForGantt = (date) => date.toISOString().split('T')[0];

        const ganttTasks = tasks.map(task => { 
            const startDate = task.scheduled_start_date ? task.scheduled_start_date.split('T')[0] : null; 
            const endDate = task.scheduled_end_date ? task.scheduled_end_date.split('T')[0] : null; 
            
            let progress = 0;
            let customClass = ''; 
            
            if (task.status === 'completed' || task.actual_end_date) {
                progress = 100;
            } else if (task.status === 'doing' || task.actual_start_date) {
                if (startDate && endDate) {
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    const now = new Date();
                    const totalDuration = end.getTime() - start.getTime();
                    const elapsedDuration = now.getTime() - start.getTime();
                    if (totalDuration > 0) {
                        progress = Math.min(100, Math.max(0, (elapsedDuration / totalDuration) * 100));
                    } else {
                        progress = 0; 
                    }
                }
            }

            // customClass ロジック（前回修正済み）
            if (task.status === 'doing') {
                // 'doing' タスクは専用のスタイル（オレンジ）
                customClass = 'gantt-task-doing';
            } else if (task.status === 'todo') {
                // 'todo' タスク（未開始）に専用のスタイル（灰色）。
                // is_not_main や doing との優先順位はCSSの記述順に依存。
                customClass = 'gantt-task-todo';
            }

            if (task.is_not_main) {
                // is_not_main は他のステータスと併用可能なので、既存のクラスに追加される
                // CSSの記述順が 'gantt-task-not-main' の方が新しい 'gantt-task-todo' より後であれば、
                // 'todo' かつ 'is_not_main' の場合は紫が優先される。
                customClass = (customClass ? customClass + ' ' : '') + 'gantt-task-not-main';
            }

            if (!startDate || !endDate) {
                return null;
            }

            return {
                id: String(task.id),
                name: task.name,
                start: startDate,
                end: endDate,
                progress: progress,
                dependencies: '',
                custom_class: customClass
            };
        }).filter(t => t !== null); 

        // Add dummy tasks to force the date range from today-2 to today+3months
        ganttTasks.unshift({ 
            id: 'dummy-start-date-forcer',
            name: '', 
            start: formatDateForGantt(twoDaysAgo),
            end: formatDateForGantt(twoDaysAgo), 
            progress: 0,
            custom_class: 'gantt-dummy-task' 
        });

        ganttTasks.push({
            id: 'dummy-end-date-forcer',
            name: '', 
            start: formatDateForGantt(threeMonthsLater),
            end: formatDateForGantt(threeMonthsLater), 
            progress: 0,
            custom_class: 'gantt-dummy-task' 
        });

        // 削除: Ganttタスクの強制ソートを削除済み
        // ganttTasks.sort((a, b) => new Date(a.start) - new Date(b.start)); 

        const actualVisibleTasks = tasks.filter(t => t.scheduled_start_date && t.scheduled_end_date);
        if (actualVisibleTasks.length === 0 && ganttTasks.filter(t => !t.id.startsWith('dummy-')).length === 0 ) {
            const noGanttMessage = document.createElement('p');
            noGanttMessage.textContent = 'No tasks with scheduled dates to display in Gantt chart.';
            noGanttMessage.className = 'text-gray-500 italic text-center py-8'; 
            ganttTarget.appendChild(noGanttMessage);
        }
        
        // eslint-disable-next-line no-undef
        currentGanttInstance = new Gantt("#gantt-target", ganttTasks, {
            header_height: 50,
            column_width: 30, 
            step: 24, 
            view_modes: ganttViewModes, 
            bar_height: 20,
            bar_corner_radius: 3,
            arrow_curve: 5,
            padding: 18,
            view_mode: 'Day', 
            date_format: 'YYYY-MM-DD',
            custom_popup_html: null, 
            on_click: function (task) {
                if (!task.id.startsWith('dummy-')) {
                    showEditTaskPopupWithDetails(task.id);
                }
            },
        });

        console.log("Calling addTodayLineToGanttChart from renderGraphicalGantt.");
        addTodayLineToGanttChart(); 

        if (ganttTarget && !ganttTarget.dataset.wheelListenerAdded) {
            ganttTarget.addEventListener('wheel', function(event) {
                if (event.ctrlKey && currentGanttInstance) {
                    event.preventDefault(); 
    
                    const currentViewMode = currentGanttInstance.options.view_mode; 
                    let currentIndex = ganttViewModes.indexOf(currentViewMode);
    
                    if (currentIndex === -1) { 
                        console.warn("Current Gantt view mode not in predefined list. Falling back to Week.");
                        currentIndex = ganttViewModes.indexOf('Week'); 
                        if(currentIndex === -1) currentIndex = 2; 
                    }
    
                    if (event.deltaY < 0) { 
                        currentIndex--;
                    } else { 
                        currentIndex++;
                    }
    
                    if (currentIndex < 0) {
                        currentIndex = 0;
                    } else if (currentIndex >= ganttViewModes.length) { 
                        currentIndex = ganttViewModes.length - 1;
                    }
    
                    const newViewMode = ganttViewModes[currentIndex];
                    if (newViewMode && newViewMode !== currentGanttInstance.options.view_mode) {
                        currentGanttInstance.change_view_mode(newViewMode);
                        console.log("View mode changed, re-adding today's line.");
                        addTodayLineToGanttChart(); 
                    }
                } 
            });
            ganttTarget.dataset.wheelListenerAdded = 'true'; 
        }
    }
    
    function addTodayLineToGanttChart() {
        console.log("addTodayLineToGanttChart called.");

        const svg = ganttTarget.querySelector('svg');
        if (!svg || !currentGanttInstance) {
            console.warn("SVG element or currentGanttInstance not ready for today line. Skipping.");
            return;
        }

        const oldTodayLine = svg.querySelector('.today-line');
        if (oldTodayLine) {
            oldTodayLine.remove();
            console.log("Removed old today line.");
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0); 

        let foundTodayX = -1;

        const todayHighlightRect = svg.querySelector('.grid .today-highlight');
        if (todayHighlightRect) {
            foundTodayX = parseFloat(todayHighlightRect.getAttribute('x')) + (parseFloat(todayHighlightRect.getAttribute('width')) / 2);
            console.log("Found today highlight rect. X:", foundTodayX);
        } else {
            if (currentGanttInstance.dates && currentGanttInstance.dates.length > 0) {
                console.log("Inspecting currentGanttInstance.dates:", currentGanttInstance.dates); 
                if (currentGanttInstance.dates[0] && typeof currentGanttInstance.dates[0].date !== 'undefined' && typeof currentGanttInstance.dates[0].x !== 'undefined') {
                    console.log("First element test:", currentGanttInstance.dates[0].date, currentGanttInstance.dates[0].x); 
                } else {
                     console.warn("currentGanttInstance.dates elements might not have 'date' or 'x' properties as expected.");
                }


                let closestDateCol = null;
                let minDiff = Infinity;
                
                for (const dateCol of currentGanttInstance.dates) {
                    const dateObj = new Date(dateCol.date); 
                    dateObj.setHours(0,0,0,0);
                    const diff = Math.abs(dateObj.getTime() - today.getTime());

                    if (dateObj <= today) { 
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestDateCol = dateCol;
                        }
                    } else if (dateObj.getTime() === today.getTime()) { 
                        closestDateCol = dateCol;
                        break;
                    }
                }
                
                if (closestDateCol) {
                    const columnWidth = currentGanttInstance.options.column_width; 
                    foundTodayX = closestDateCol.x + (columnWidth / 2);
                    console.log("Calculated today line X using Frappe Gantt's internal dates:", foundTodayX);
                } else {
                    console.warn("Could not find internal date for today. Today line not drawn. (closestDateCol was null)");
                }
            } else {
                console.warn("Frappe Gantt internal 'dates' property not accessible or empty. Today line not drawn.");
            }
        }

        if (foundTodayX !== -1) {
            const svgHeight = svg.clientHeight; 

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', foundTodayX);
            line.setAttribute('y1', 0); 
            line.setAttribute('x2', foundTodayX);
            line.setAttribute('y2', svgHeight); 
            line.classList.add('today-line'); 

            svg.appendChild(line);
            console.log("Today line successfully added at X:", foundTodayX);
        } else {
            console.error("Failed to calculate today line X coordinate across all view modes. Today line not drawn.");
        }
    }
    
    function renderCompletedTasks(tasks) {
        completedTasksListArea.innerHTML = ''; 
        if (!tasks || tasks.length === 0) {
            const noCompletedMessage = document.createElement('p');
            noCompletedMessage.textContent = 'No completed tasks.';
            noCompletedMessage.className = 'text-gray-500 italic'; 
            completedTasksListArea.appendChild(noCompletedMessage);
            return;
        } 
        const ul = document.createElement('ul');
        ul.className = 'task-list-condensed divide-y divide-gray-200'; 
        tasks.forEach(task => { 
            const li = document.createElement('li');
            li.className = 'task-item-condensed flex justify-between items-center py-2 text-sm text-gray-700 cursor-pointer'; 
            li.dataset.taskId = task.id; 
            
            const textSpan = document.createElement('span');
            textSpan.textContent = `${task.name} (Completed: ${new Date(task.actual_end_date).toLocaleDateString()})`;
            
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'restore-btn bg-green-500 hover:bg-green-600 text-white px-3 py-1 text-xs rounded-md ml-2 transition-colors duration-200'; 
            restoreBtn.dataset.taskId = task.id;
            restoreBtn.textContent = 'Restore';
            
            li.appendChild(textSpan);
            li.appendChild(restoreBtn);
            ul.appendChild(li);

            li.addEventListener('click', async (event) => {
                if (!event.target.classList.contains('restore-btn')) {
                    showViewTaskDetailsPopupWithDetails(task.id);
                }
            });
        });
        completedTasksListArea.appendChild(ul);
    }

    function renderDeletedTasks(tasks) {
        deletedTasksListArea.innerHTML = ''; 
        if (!tasks || tasks.length === 0) {
            const noDeletedMessage = document.createElement('p');
            noDeletedMessage.textContent = 'No deleted tasks.';
            noDeletedMessage.className = 'text-gray-500 italic'; 
            deletedTasksListArea.appendChild(noDeletedMessage);
            return;
        }
        const ul = document.createElement('ul');
        ul.className = 'task-list-condensed divide-y divide-gray-200'; 
        tasks.forEach(task => { 
            const li = document.createElement('li');
            li.className = 'task-item-condensed flex justify-between items-center py-2 text-sm text-gray-700 cursor-pointer'; 
            li.dataset.taskId = task.id; 
            
            const textSpan = document.createElement('span');
            let text = `${task.name} (Deleted: ${new Date(task.updated_at).toLocaleDateString()})`;
            if (task.delete_reason) {
                text += ` - Reason: ${task.delete_reason}`;
            }
            textSpan.textContent = text;

            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'restore-btn bg-green-500 hover:bg-green-600 text-white px-3 py-1 text-xs rounded-md ml-2 transition-colors duration-200'; 
            restoreBtn.dataset.taskId = task.id;
            restoreBtn.textContent = 'Restore';
            
            li.appendChild(textSpan);
            li.appendChild(restoreBtn);
            ul.appendChild(li);

            li.addEventListener('click', async (event) => {
                if (!event.target.classList.contains('restore-btn')) {
                    showViewTaskDetailsPopupWithDetails(task.id);
                }
            });
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
            // Assuming taskDetails.id is available and correct
            showEditTaskPopupUI(taskDetails);
        } catch (error) {
            console.error('Error fetching task details for popup:', error);
            alert(`Error fetching task details: ${error.message}`);
        }
    }

    async function showViewTaskDetailsPopupWithDetails(taskId) {
        try {
            const response = await fetch(`/task/${taskId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const taskDetails = await response.json();
            // Assuming taskDetails.id is available and correct
            showViewTaskDetailsPopupUI(taskDetails);
        } catch (error) {
            console.error('Error fetching task details for view popup:', error);
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
            console.log("fetchAndRenderActiveTasks: Calling renderGraphicalGantt.");
            renderGraphicalGantt(tasks); 
            
            const activeTasksULElement = document.getElementById('active-tasks-ul');
            if (activeTasksULElement && sortBy === 'display_order' && tasks.length > 0) {
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
                                    // 別のソート順で表示していた場合は、display_orderに戻す
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
            } else if (sortableInstance) {
                // display_order 以外のソートの場合やタスクが0件の場合は並び替えを無効化
                sortableInstance.destroy();
                sortableInstance = null;
            }

        } catch (error) {
            console.error('Error fetching tasks:', error);
            taskListArea.innerHTML = `<p class="text-red-600">Error loading tasks: ${error.message}</p>`; 
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
            completedTasksListArea.innerHTML = `<p class="text-red-600">Error loading completed tasks: ${error.message}</p>付け`; 
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
            deletedTasksListArea.innerHTML = `<p class="text-red-600">Error loading deleted tasks: ${error.message}</p>`; 
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

        // 既存のバリデーションメッセージを修正
        if ((scheduled_start_date && !scheduled_end_date) || (!scheduled_start_date && scheduled_end_date)) { 
            addErrorMessageDiv.textContent = '予定開始日と予定終了日の両方が提供されなければなりません。'; // 修正
            return;
        }

        // --- NEW: Scheduled Date Validation (開始日 < 終了日) ---
        if (scheduled_start_date && scheduled_end_date) {
            const startDateObj = new Date(scheduled_start_date);
            const endDateObj = new Date(scheduled_end_date);

            if (startDateObj > endDateObj) {
                alert('予定開始日が予定終了日よりも後の日付になっています。開始日を終了日と同じかそれ以前に設定してください。');
                addErrorMessageDiv.textContent = '予定開始日が予定終了日より後の日付です。'; // エラーメッセージ表示
                return; // フォーム送信をブロック
            }
        }
        // --- NEW 終わり ---

        const is_not_main = taskIsNotMainCheckbox.checked; 

        const taskData = {
            name, detail, limit_date, is_not_main,
            scheduled_start_date: scheduled_start_date || null, 
            scheduled_end_date: scheduled_end_date || null 
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
            addErrorMessageDiv.textContent = `Error: ${error.error || '予期せぬエラーが発生しました。'}`;
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

        // 既存のバリデーションメッセージを修正
        if ((scheduled_start_date && !scheduled_end_date) || (!scheduled_start_date && scheduled_end_date)) {
            editErrorMessageDiv.textContent = '予定開始日と予定終了日の両方が提供されなければなりません。'; // 修正
            return;
        }
        
        // --- NEW: Scheduled Date Validation (開始日 < 終了日) ---
        if (scheduled_start_date && scheduled_end_date) {
            const startDateObj = new Date(scheduled_start_date);
            const endDateObj = new Date(scheduled_end_date);

            if (startDateObj > endDateObj) {
                alert('予定開始日が予定終了日よりも後の日付になっています。開始日を終了日と同じかそれ以前に設定してください。');
                editErrorMessageDiv.textContent = '予定開始日が予定終了日より後の日付です。'; // エラーメッセージ表示
                return; // フォーム送信をブロック
            }
        }
        // --- NEW 終わり ---

        const is_not_main = editTaskIsNotMainCheckbox.checked;

        const taskData = {
            name, detail, limit_date, is_not_main, 
            scheduled_start_date: scheduled_start_date || null, 
            scheduled_end_date: scheduled_end_date || null      
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
        }
        catch (error) {
            console.error('Error updating task:', error);
            editErrorMessageDiv.textContent = `Error: ${error.error || '予期せぬエラーが発生しました。'}`;
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
            deleteConfirmErrorMessageDiv.textContent = `Error: ${error.error || '予期せぬエラーが発生しました。'}`;
        }
    });
    
    // --- Event Delegation for Restore Buttons ---
    async function handleRestoreTask(event) {
        if (event.target.classList.contains('restore-btn') || event.target.id === 'restore-from-view-btn') {
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

                if (event.target.id === 'restore-from-view-btn') {
                    hideViewTaskDetailsPopup();
                }

                fetchAndRenderActiveTasks(); 
                fetchAndRenderCompletedTasks(); 
                fetchAndRenderDeletedTasks(); 
            } catch (error) {
                console.error('Error restoring task:', error);
                alert(`Error restoring task: ${error.error || '予期せぬエラーが発生しました。'}`);
            }
        }
    }

    // NEW: Function to handle Start/Stop button click
    async function handleStartStopTaskClick() {
        const taskId = editTaskIdInput.value;
        editErrorMessageDiv.textContent = ''; 
        
        let targetUrl = '';
        let successMessage = '';
        
        if (currentEditTaskDetails && currentEditTaskDetails.status === 'doing') {
            // 現在 'doing' なら Pause (Stop)
            targetUrl = `/pause_task/${taskId}`;
            successMessage = 'Task paused.';
        } else {
            // それ以外なら Start
            targetUrl = `/start_task/${taskId}`;
            successMessage = 'Task started.';
        }

        try {
            const response = await fetch(targetUrl, { method: 'POST' });
            if (!response.ok) {
                const err = await response.json();
                throw err;
            }
            const data = await response.json();
            
            console.log(successMessage);
            // 内部のtaskDetailsを更新 (Edit Popupの状態を反映)
            if (currentEditTaskDetails && currentEditTaskDetails.id == taskId) {
                currentEditTaskDetails.actual_start_date = data.actual_start_date !== undefined ? data.actual_start_date : currentEditTaskDetails.actual_start_date;
                currentEditTaskDetails.actual_end_date = data.actual_end_date !== undefined ? data.actual_end_date : null; // Pauseの場合はクリアされる可能性
                currentEditTaskDetails.status = data.status; 
                updateEditActionButtonsState(); // ボタンの状態を再更新
            }
            fetchAndRenderActiveTasks(); 
        } catch (error) {
            console.error('Error during start/stop task:', error);
            editErrorMessageDiv.textContent = `Error: ${error.error || '予期せぬエラーが発生しました。'}`;
        }
    }


    // --- Event Listeners for UI interactions ---
    addTaskBtn.addEventListener('click', showAddTaskPopup);
    cancelAddTaskBtn.addEventListener('click', hideAddTaskPopup);
    cancelEditTaskBtn.addEventListener('click', hideEditTaskPopup);
    cancelDeleteConfirmBtn.addEventListener('click', hideDeleteConfirmPopup);
    closeViewTaskDetailsBtn.addEventListener('click', hideViewTaskDetailsPopup); 
    restoreFromViewBtn.addEventListener('click', handleRestoreTask); 
    
    deleteFromEditBtn.addEventListener('click', () => {
        const taskId = editTaskIdInput.value;
        if (taskId) {
            showDeleteConfirmPopup(taskId);
        } else {
            console.error("Task ID not found in edit form for deletion.");
        }
    });

    // Start/Stopボタンのイベントリスナーを新しい共通関数に置き換え
    startTaskBtn.removeEventListener('click', async () => {}); // 既存の匿名関数リスナーを削除 (念のため)
    startTaskBtn.addEventListener('click', handleStartStopTaskClick); // 新しい関数を割り当て
    
    sortByLimitBtn.addEventListener('click', () => {
        fetchAndRenderActiveTasks('limit_date');
    });

    // endTaskBtnはそのまま
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
            editErrorMessageDiv.textContent = `Error: ${error.error || '予期せぬエラーが発生しました。'}`;
        }
    });
    
    completedTasksListArea.addEventListener('click', handleRestoreTask);
    deletedTasksListArea.addEventListener('click', handleRestoreTask);
    
    if (popupOverlay) {
        popupOverlay.addEventListener('click', (event) => {
            if (event.target === popupOverlay) {
                if (!addTaskPopup.classList.contains('hidden') ||
                    !editTaskPopup.classList.contains('hidden') ||
                    !deleteConfirmPopup.classList.contains('hidden') ||
                    !viewTaskDetailsPopup.classList.contains('hidden')) { 
                    hideAddTaskPopup(); 
                    hideEditTaskPopup();
                    hideDeleteConfirmPopup();
                    hideViewTaskDetailsPopup(); 
                }
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                hideAddTaskPopup();
                hideEditTaskPopup();
                hideDeleteConfirmPopup();
                hideViewTaskDetailsPopup(); 
            }
        });
    }
   
    // Initial fetch and render
    fetchAndRenderActiveTasks();
    fetchAndRenderCompletedTasks();
    fetchAndRenderDeletedTasks();
});