import React, { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import styles from './VersioningPanel.module.css';
import VersionEditForm from './VersionEditForm';

const RecipeVersioning = ({
    recipe,
    versions,
    currentVersion,
    onVersionSelect,
    onCreateVersion,
    isOpen,
    onOpenChange,
    onUpdateRecipe,
    onSetDefault
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showVersionForm, setShowVersionForm] = useState(false);

    const handleSetDefault = async (version) => {
        try {
            await onSetDefault(version);
        } catch (error) {
            console.error('Error setting version as default:', error);
            alert('Failed to update the main recipe. Please try again.');
        }
    };

    const handleCreateVersion = (formData) => {
        try {
            onCreateVersion(formData);
            setShowVersionForm(false);
        } catch (error) {
            console.error('Error creating version:', error);
            alert('Failed to create new version. Please try again.');
        }
    };

    return (
        <div className={styles.versioningPanel}>
            <div className={styles.header}>
                <button
                    className={styles.headerButton}
                    onClick={() => {
                        const newState = !isExpanded;
                        setIsExpanded(newState);
                        onOpenChange?.(newState);
                    }}
                    aria-expanded={isExpanded}
                    aria-controls={`versioning-content-${recipe.id}`}
                >
                    <span className={styles.headerText}>
                        Recipe Versions ({versions?.length || 0})
                    </span>
                    <ChevronDown
                        size={20}
                        style={{
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                            transition: 'transform 0.2s'
                        }}
                        aria-hidden="true"
                    />
                </button>
            </div>

            {isExpanded && (
                <div id={`versioning-content-${recipe.id}`} className={styles.content}>
                    <button
                        type="button"
                        onClick={() => setShowVersionForm(true)}
                        className={styles.addButton}
                    >
                        <Plus size={16} />
                        Create New Version
                    </button>

                    <div className={styles.versionList}>
                        {versions && versions.length > 0 ? (
                            versions.map((version) => (
                                <div key={version.id} className={styles.versionItem}>
                                    <button
                                        className={`${styles.versionButton} ${
                                            currentVersion?.id === version.id ? styles.versionButtonActive : ''
                                        }`}
                                        onClick={() => onVersionSelect(version)}
                                    >
                                        {version.meal_version_name || 'Unnamed Version'}
                                        {version.makeDefault && (
                                            <span className={styles.defaultBadge}>Main Recipe</span>
                                        )}
                                    </button>
                                    {!version.makeDefault && (
                                        <button
                                            className={styles.defaultButton}
                                            onClick={() => handleSetDefault(version)}
                                            title="Make this the main recipe"
                                        >
                                            Set as Main
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className={styles.noVersions}>
                                No versions available. Create your first variation of this recipe.
                            </p>
                        )}
                    </div>
                </div>
            )}

            <VersionEditForm
                isOpen={showVersionForm}
                onClose={() => setShowVersionForm(false)}
                recipe={recipe}
                onSave={handleCreateVersion}
            />
        </div>
    );
};

export default RecipeVersioning;
