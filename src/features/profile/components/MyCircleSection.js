import React, { useState, useEffect } from 'react';
import { Copy, Check, Users, DollarSign, Share2, Plus, X } from 'lucide-react';
import {
  initializeMyCircle,
  getMyCircleData,
  getMyCircleLink,
  getCircleMembers,
  addCircleMember,
  removeCircleMember,
  getEarningsSummary
} from '../../../services/myCircleService';
import { copyLinkToClipboard } from '../../../services/recipeSharingService';
import { auth } from '../../../firebase';
import styles from './MyCircleSection.module.css';

/**
 * MyCircleSection Component
 *
 * Main hub for managing your cooking community, invitations, and earnings
 */
export default function MyCircleSection({ userId }) {
  const [circleData, setCircleData] = useState(null);
  const [circleLink, setCircleLink] = useState(null);
  const [members, setMembers] = useState({ family: [], clients: [], friends: [] });
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [needsInitialization, setNeedsInitialization] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, members, invite
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  useEffect(() => {
    loadMyCircleData();
  }, []);

  async function loadMyCircleData() {
    setLoading(true);
    try {
      const [data, link, membersData, earningsData] = await Promise.all([
        getMyCircleData(),
        getMyCircleLink(),
        getCircleMembers(),
        getEarningsSummary()
      ]);

      // Check if My Circle needs initialization
      if (!data || !link) {
        setNeedsInitialization(true);
        setLoading(false);
        return;
      }

      setCircleData(data);
      setCircleLink(link);
      setMembers(membersData);
      setEarnings(earningsData);
      setNeedsInitialization(false);
    } catch (error) {
      console.error('Error loading My Circle data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleInitializeCircle() {
    setInitializing(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        alert('Please sign in to initialize your circle');
        return;
      }

      const userName = user.displayName || user.email?.split('@')[0] || 'User';
      const userIdToUse = userId || user.uid;

      console.log('Initializing My Circle with userId:', userIdToUse);
      await initializeMyCircle(userIdToUse, userName);

      // Reload all circle data
      await loadMyCircleData();
    } catch (error) {
      console.error('Error initializing My Circle:', error);
      alert('Failed to initialize My Circle. Please try again.');
    } finally {
      setInitializing(false);
    }
  }

  async function handleCopyLink() {
    if (!circleLink) return;

    const success = await copyLinkToClipboard(circleLink.url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleAddMember(memberData) {
    try {
      await addCircleMember(memberData);
      await loadMyCircleData(); // Refresh data
      setShowAddMemberModal(false);
    } catch (error) {
      console.error('Error adding member:', error);
      alert(error.message || 'Failed to add member');
    }
  }

  async function handleRemoveMember(memberId, relationship) {
    if (!window.confirm('Remove this person from your circle?')) return;

    try {
      await removeCircleMember(memberId, relationship);
      await loadMyCircleData(); // Refresh data
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <p>Loading your circle...</p>
        </div>
      </div>
    );
  }

  // Show welcome screen if My Circle needs initialization
  if (needsInitialization) {
    return (
      <div className={styles.container}>
        <div className={styles.welcomeScreen}>
          <div className={styles.welcomeIcon}>
            <Users size={64} />
          </div>
          <h2>Welcome to My Circle</h2>
          <p className={styles.welcomeSubtitle}>Your cooking community & rewards hub</p>

          <div className={styles.welcomeFeatures}>
            <div className={styles.welcomeFeature}>
              <Users size={24} />
              <h3>Build Your Community</h3>
              <p>Connect with family, friends, and clients to share the joy of simplified cooking</p>
            </div>

            <div className={styles.welcomeFeature}>
              <Share2 size={24} />
              <h3>Share & Collaborate</h3>
              <p>Share recipes, meal plans, and cooking tips with your circle</p>
            </div>

            <div className={styles.welcomeFeature}>
              <DollarSign size={24} />
              <h3>Earn Rewards</h3>
              <p>Get rewarded when you invite others to join Savor Meals</p>
            </div>
          </div>

          <button
            className={styles.primaryButton}
            onClick={handleInitializeCircle}
            disabled={initializing}
          >
            {initializing ? 'Setting up your circle...' : 'Get Started'}
          </button>
        </div>
      </div>
    );
  }

  const stats = circleData.stats || {};
  const totalMembers = stats.totalMembers || 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2>My Circle</h2>
          <p>Your cooking community</p>
        </div>
        <button className={styles.inviteButton} onClick={() => setActiveTab('invite')}>
          <Plus size={20} />
          <span>Invite to Circle</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'members' ? styles.active : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members ({totalMembers})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'earnings' ? styles.active : ''}`}
          onClick={() => setActiveTab('earnings')}
        >
          Earnings
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'invite' ? styles.active : ''}`}
          onClick={() => setActiveTab('invite')}
        >
          Invite
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {activeTab === 'overview' && (
          <OverviewTab
            stats={stats}
            earnings={earnings}
            members={members}
            onViewMembers={() => setActiveTab('members')}
            onViewEarnings={() => setActiveTab('earnings')}
          />
        )}

        {activeTab === 'members' && (
          <MembersTab
            members={members}
            onAddMember={() => setShowAddMemberModal(true)}
            onRemoveMember={handleRemoveMember}
          />
        )}

        {activeTab === 'earnings' && (
          <EarningsTab earnings={earnings} stats={stats} />
        )}

        {activeTab === 'invite' && (
          <InviteTab
            circleLink={circleLink}
            copied={copied}
            onCopyLink={handleCopyLink}
            onAddMember={() => setShowAddMemberModal(true)}
          />
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <AddMemberModal
          onClose={() => setShowAddMemberModal(false)}
          onSubmit={handleAddMember}
        />
      )}
    </div>
  );
}

/**
 * Overview Tab - Dashboard with stats
 */
function OverviewTab({ stats, earnings, members, onViewMembers, onViewEarnings }) {
  const totalMembers = stats.totalMembers || 0;
  const familyCount = members.family?.length || 0;
  const clientsCount = members.clients?.length || 0;
  const friendsCount = members.friends?.length || 0;

  return (
    <div className={styles.overviewTab}>
      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Users size={24} />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{totalMembers}</div>
            <div className={styles.statLabel}>Circle Members</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Share2 size={24} />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats.sharedRecipes || 0}</div>
            <div className={styles.statLabel}>Shared Recipes</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <DollarSign size={24} />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>${earnings?.thisMonth?.toFixed(2) || '0.00'}</div>
            <div className={styles.statLabel}>This Month</div>
          </div>
        </div>
      </div>

      {/* Members Overview */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Circle Members</h3>
          <button className={styles.linkButton} onClick={onViewMembers}>
            View All
          </button>
        </div>

        <div className={styles.memberSummary}>
          <div className={styles.memberType}>
            <span className={styles.memberTypeLabel}>Family</span>
            <span className={styles.memberTypeCount}>{familyCount}</span>
          </div>
          <div className={styles.memberType}>
            <span className={styles.memberTypeLabel}>Clients</span>
            <span className={styles.memberTypeCount}>{clientsCount}</span>
          </div>
          <div className={styles.memberType}>
            <span className={styles.memberTypeLabel}>Friends</span>
            <span className={styles.memberTypeCount}>{friendsCount}</span>
          </div>
        </div>
      </div>

      {/* Earnings Summary */}
      {earnings && earnings.total > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Earnings Summary</h3>
            <button className={styles.linkButton} onClick={onViewEarnings}>
              View Details
            </button>
          </div>

          <div className={styles.earningsSummary}>
            <div className={styles.earningsRow}>
              <span>Total Earned</span>
              <span className={styles.amount}>${earnings.total.toFixed(2)}</span>
            </div>
            <div className={styles.earningsRow}>
              <span>Pending</span>
              <span className={styles.amount}>${earnings.pending.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Getting Started */}
      {totalMembers === 0 && (
        <div className={styles.emptyState}>
          <h3>Start Building Your Circle</h3>
          <p>Invite family, friends, or clients to share the joy of simplified cooking</p>
          <button className={styles.primaryButton} onClick={onViewMembers}>
            Add Your First Member
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Members Tab - List and manage circle members
 */
function MembersTab({ members, onAddMember, onRemoveMember }) {
  const allMembers = [
    ...members.family.map(m => ({ ...m, type: 'family' })),
    ...members.clients.map(m => ({ ...m, type: 'clients' })),
    ...members.friends.map(m => ({ ...m, type: 'friends' }))
  ];

  if (allMembers.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Users size={48} />
        <h3>No members yet</h3>
        <p>Start building your circle by adding family, friends, or clients</p>
        <button className={styles.primaryButton} onClick={onAddMember}>
          <Plus size={20} />
          <span>Add First Member</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.membersTab}>
      <div className={styles.membersHeader}>
        <h3>Circle Members ({allMembers.length})</h3>
        <button className={styles.addButton} onClick={onAddMember}>
          <Plus size={18} />
          <span>Add Member</span>
        </button>
      </div>

      <div className={styles.membersList}>
        {allMembers.map((member) => (
          <div key={member.id} className={styles.memberCard}>
            <div className={styles.memberInfo}>
              <div className={styles.memberAvatar}>
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className={styles.memberName}>{member.name}</div>
                <div className={styles.memberEmail}>{member.email}</div>
              </div>
            </div>

            <div className={styles.memberMeta}>
              <span className={`${styles.badge} ${styles[member.type]}`}>
                {member.type}
              </span>
              <span className={`${styles.status} ${styles[member.status]}`}>
                {member.status}
              </span>
              <button
                className={styles.removeButton}
                onClick={() => onRemoveMember(member.id, member.type)}
                title="Remove from circle"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Earnings Tab - Referral rewards and creator earnings
 */
function EarningsTab({ earnings, stats }) {
  if (!earnings || earnings.total === 0) {
    return (
      <div className={styles.emptyState}>
        <DollarSign size={48} />
        <h3>Start Earning</h3>
        <p>Invite friends to Savor Meals and earn rewards when they join and create meal plans</p>
        <div className={styles.earningsInfo}>
          <h4>How to Earn</h4>
          <ul>
            <li>$5 when someone you invite creates their first meal plan</li>
            <li>$0.25 per meal plan created by your referrals</li>
            <li>$0.50 per recipe added by your referrals</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.earningsTab}>
      <div className={styles.earningsOverview}>
        <div className={styles.earningsCard}>
          <div className={styles.earningsLabel}>This Month</div>
          <div className={styles.earningsValue}>${earnings.thisMonth.toFixed(2)}</div>
        </div>
        <div className={styles.earningsCard}>
          <div className={styles.earningsLabel}>Total Earned</div>
          <div className={styles.earningsValue}>${earnings.total.toFixed(2)}</div>
        </div>
        <div className={styles.earningsCard}>
          <div className={styles.earningsLabel}>Pending</div>
          <div className={styles.earningsValue}>${earnings.pending.toFixed(2)}</div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Earnings Breakdown</h3>
        <div className={styles.breakdownList}>
          <div className={styles.breakdownItem}>
            <span>Referral Bonuses</span>
            <span className={styles.amount}>${earnings.byType?.referralBonuses?.toFixed(2) || '0.00'}</span>
          </div>
          <div className={styles.breakdownItem}>
            <span>Activity Rewards</span>
            <span className={styles.amount}>${earnings.byType?.activityRewards?.toFixed(2) || '0.00'}</span>
          </div>
          <div className={styles.breakdownItem}>
            <span>Recipe Sales</span>
            <span className={styles.amount}>${earnings.byType?.recipeSales?.toFixed(2) || '0.00'}</span>
          </div>
          <div className={styles.breakdownItem}>
            <span>Template Sales</span>
            <span className={styles.amount}>${earnings.byType?.templateSales?.toFixed(2) || '0.00'}</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Network Stats</h3>
        <div className={styles.networkStats}>
          <div className={styles.networkStat}>
            <span>Successful Referrals</span>
            <span className={styles.statNumber}>{stats.successfulReferrals || 0}</span>
          </div>
        </div>
      </div>

      <button className={styles.primaryButton} disabled>
        Cash Out (Coming Soon)
      </button>
    </div>
  );
}

/**
 * Invite Tab - Referral tools and invite management
 */
function InviteTab({ circleLink, copied, onCopyLink, onAddMember }) {
  return (
    <div className={styles.inviteTab}>
      {/* Referral Link */}
      <div className={styles.section}>
        <h3>Your Referral Link</h3>
        <p>Share this link with anyone you'd like to invite to Savor Meals</p>

        <div className={styles.linkCard}>
          <div className={styles.codeDisplay}>
            <label>Your Code</label>
            <div className={styles.code}>{circleLink.code}</div>
          </div>

          <div className={styles.linkInput}>
            <input type="text" value={circleLink.url} readOnly />
            <button onClick={onCopyLink} className={copied ? styles.copied : ''}>
              {copied ? (
                <>
                  <Check size={18} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={18} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Add to Circle */}
      <div className={styles.section}>
        <h3>Add Someone Directly</h3>
        <p>Add family members or clients directly to your circle</p>
        <button className={styles.primaryButton} onClick={onAddMember}>
          <Plus size={20} />
          <span>Add Member</span>
        </button>
      </div>

      {/* How It Works */}
      <div className={styles.section}>
        <h3>How It Works</h3>
        <ol className={styles.howItWorks}>
          <li>Share your unique referral link</li>
          <li>They sign up using your link</li>
          <li>You earn $5 when they create their first meal plan</li>
          <li>Continue earning as they use the app</li>
        </ol>
      </div>
    </div>
  );
}

/**
 * Add Member Modal
 */
function AddMemberModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    relationship: 'friends',
    permissions: {
      viewMealPlans: false,
      shareRecipes: true,
      collaboration: false,
      trackProgress: false
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  function handlePermissionChange(permission, value) {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: value
      }
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Add to Circle</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              required
              placeholder="Enter their name"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
              required
              placeholder="their@email.com"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Relationship *</label>
            <select
              value={formData.relationship}
              onChange={e => handleChange('relationship', e.target.value)}
            >
              <option value="family">Family Member</option>
              <option value="clients">Nutrition Client</option>
              <option value="friends">Friend/Peer</option>
            </select>
          </div>

          {formData.relationship === 'clients' && (
            <div className={styles.formGroup}>
              <label>Permissions</label>
              <div className={styles.checkboxGroup}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={formData.permissions.viewMealPlans}
                    onChange={e => handlePermissionChange('viewMealPlans', e.target.checked)}
                  />
                  <span>View my meal plans</span>
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={formData.permissions.collaboration}
                    onChange={e => handlePermissionChange('collaboration', e.target.checked)}
                  />
                  <span>Collaborate on meal plans</span>
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={formData.permissions.trackProgress}
                    onChange={e => handlePermissionChange('trackProgress', e.target.checked)}
                  />
                  <span>Track their progress</span>
                </label>
              </div>
            </div>
          )}

          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add to Circle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
