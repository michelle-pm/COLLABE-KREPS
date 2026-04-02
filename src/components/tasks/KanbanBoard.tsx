import React from "react";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  horizontalListSortingStrategy
} from "@dnd-kit/sortable";
import { TaskColumn, TaskItem } from "../../types";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { useState, useEffect } from "react";

interface KanbanBoardProps {
  columns: TaskColumn[];
  tasks: TaskItem[];
  onMoveTask: (taskId: string, columnId: string, status: string, order: number) => void;
  onTaskClick: (task: TaskItem) => void;
}

export function KanbanBoard({ columns, tasks, onMoveTask, onTaskClick }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Check if dropped over a column or a task
    const overColumn = columns.find(c => c.id === overId);
    const overTask = tasks.find(t => t.id === overId);

    let targetColumnId = "";
    let targetStatus = "";
    
    if (overColumn) {
      targetColumnId = overColumn.id;
      targetStatus = overColumn.title.toLowerCase().replace(/\s+/g, '_');
    } else if (overTask) {
      targetColumnId = overTask.columnId;
      targetStatus = overTask.status;
    }

    if (targetColumnId && (activeTask.columnId !== targetColumnId)) {
      onMoveTask(activeId, targetColumnId, targetStatus as any, 0); // Order logic can be improved
    }

    setActiveTask(null);
  };

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar min-h-[600px]">
        {columns.map(column => (
          <KanbanColumn 
            key={column.id} 
            column={column} 
            tasks={tasks.filter(t => t.columnId === column.id)}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }),
      }}>
        {activeTask ? (
          <KanbanCard task={activeTask} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
