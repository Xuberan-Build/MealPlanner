# Development Stories

This directory contains automatically generated development stories that capture the journey, challenges, and solutions during the development of the Meal Planner app.

## What Are Development Stories?

Development stories are narrative documentation automatically generated from your git commits. They capture:

- **Features Added**: What new functionality was built
- **Bugs Fixed**: Issues that were resolved
- **Challenges**: Problems and obstacles encountered during development
- **Solutions**: How those challenges were overcome
- **Technical Changes**: Files modified, components affected
- **Video Script Suggestions**: Ready-to-use outlines for creating video content

## How It Works

1. **Commit with Details**: Use the commit message template to include challenges and solutions
2. **Push to GitHub**: Stories are automatically generated on every push
3. **Review Stories**: Check `docs/stories/` for the latest narrative
4. **Create Videos**: Use the video script suggestions to produce content

## Commit Message Format

To get the most out of automated stories, use this format:

```
feat(shopping-list): add template save functionality

Users can now save their current shopping list as a reusable template
for future grocery trips.

Challenge:
- Firestore batch writes were failing due to payload size limits
- Template library modal wasn't loading templates correctly

Solution:
- Implemented individual document writes for large collections
- Fixed template data structure to match expected format
- Added proper error handling and user feedback
```

## Viewing Stories

Stories are organized by date and branch:
- `YYYY-MM-DD-branch-timestamp.md`

Each story includes:
- Summary of changes
- New features with details
- Bug fixes
- Challenges and solutions
- Technical changes
- All commits in the update
- Video script suggestions

## Using Stories for Videos

Each story includes a "Video Script Suggestions" section with:
- **Opening Hook**: Attention-grabbing intro
- **Key Points**: Main topics to cover
- **Closing**: Wrap-up and teaser for next video

## Recent Stories

Stories will appear here automatically after your first push.
