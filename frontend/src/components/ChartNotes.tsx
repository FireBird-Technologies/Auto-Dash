import React, { useState, useEffect, useRef } from 'react';
import { MarkdownMessage } from './MarkdownMessage';
import { config, getAuthHeaders, checkAuthResponse } from '../config';

interface ChartNotesProps {
  chartIndex: number;
  datasetId: string;
  initialNotes?: string;
  onNotesChange?: (notes: string) => void;
  forceEdit?: boolean;
}

export const ChartNotes: React.FC<ChartNotesProps> = ({
  chartIndex,
  datasetId,
  initialNotes = '',
  onNotesChange,
  forceEdit = false
}) => {
  const [notes, setNotes] = useState(initialNotes);
  const [isEditing, setIsEditing] = useState(forceEdit || !initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update notes when initialNotes changes
  useEffect(() => {
    setNotes(initialNotes || '');
  }, [initialNotes]);

  // Handle forceEdit prop
  useEffect(() => {
    if (forceEdit) {
      setIsEditing(true);
    }
  }, [forceEdit]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [notes, isEditing]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (onNotesChange) {
      onNotesChange(value);
    }

    // Debounce save to backend
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveNotes(value);
    }, 1500);
  };

  const saveNotes = async (notesToSave: string) => {
    if (!datasetId) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `${config.backendUrl}/api/data/datasets/${datasetId}/charts/${chartIndex}/notes`,
        {
          method: 'POST',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify({ notes: notesToSave }),
        }
      );

      await checkAuthResponse(response);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save notes');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = () => {
    // Save immediately on blur
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveNotes(notes);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      if (textareaRef.current) {
        textareaRef.current.blur();
      }
    }
  };

  return (
    <div 
      data-chart-notes={chartIndex}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0
      }}
    >
      {isSaving && (
        <div style={{
          fontSize: '11px',
          color: '#6b7280',
          marginBottom: '8px',
          textAlign: 'right'
        }}>
          Saving...
        </div>
      )}
      
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Add your notes here... (Markdown supported)"
          style={{
            width: '100%',
            flex: 1,
            minHeight: '200px',
            padding: '12px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'inherit',
            lineHeight: '1.6',
            resize: 'none',
            outline: 'none',
            backgroundColor: 'white'
          }}
          autoFocus
        />
      ) : (
        <div style={{
          flex: 1,
          padding: '0',
          cursor: 'text',
          overflow: 'auto',
          minHeight: 0,
          backgroundColor: 'white'
        }}
        onClick={() => setIsEditing(true)}
        >
          {notes ? (
            <MarkdownMessage content={notes} />
          ) : (
            <p style={{
              color: '#9ca3af',
              fontStyle: 'italic',
              margin: 0
            }}>
              Click to add notes...
            </p>
          )}
        </div>
      )}
    </div>
  );
};

