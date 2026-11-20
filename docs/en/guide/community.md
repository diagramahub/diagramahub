# Community

The **Community** is the portal where users publish their diagrams so others can find them, star them, comment on them and **fork** them (an editable copy in their own account). Open it from **Community** in the sidebar. It is **public**: anyone, without an account, can browse it at `/community`, open the diagrams and read the comments. Starring, forking, commenting, reporting or publishing asks a signed-out visitor to create an account or sign in, and brings them back to the same page afterwards. (Whoever runs the instance can close it with [`COMMUNITY_PUBLIC`](../self-host/configuration.md#community).)

## Browse

| Tab | What it shows |
|---|---|
| **Explore** | Every published diagram |
| **Featured** | The ones administrators pick |
| **My stars** | The ones you starred |
| **My publications** | Yours (also the ones hidden by moderation) |

You can **search** by title, author, tag or description, filter by **type** (MMD, PUML, D2, DBML) and **category** (Architecture, Databases, Business processes, DevOps, UML, Security, AI and data, Education), and **sort** by trending, stars, forks or date. *Trending* favors recent diagrams with more stars and forks.

## Publish a diagram

1. Open the diagram in the editor and use **Publish to the Community** (globe icon in the toolbar). The window has two panes.
2. On the left, the **public description**: it's the diagram's description, with the same Markdown editor. What you change there is saved to the diagram.
3. On the right, the settings:
    - the **category**;
    - up to 5 **tags**, in lowercase: add each one with **Enter** or a **comma**, and remove it with its ✕ or Backspace;
    - whether you allow **comments**.
4. **Publish**.

What you publish is **always in sync** with the diagram: when you change its title, code or description, the Community shows the new version without publishing again. If you delete the diagram, its last version stays published until you remove it.

Your published diagrams carry the **Public** mark (a green globe) in the folder explorer, next to the title in the editor and in the dashboard's recent diagrams. If moderation hides one, the mark turns into an amber **Hidden**. Clicking the mark in the editor opens the publication settings.

To change the category, tags or comments of something already published, open the same window and use **Save changes**. Each diagram can be published once. Whiteboard sketches can't be published yet.

To be published, a diagram has to draw something: it can't be empty or have errors that keep it from rendering, and its code can't be over 100,000 characters. There's also a maximum of publications per day.

!!! tip "Public diagrams don't count toward your limit"
    While a diagram is published, it usually **doesn't use a slot** of your plan's diagram limit: publishing one frees a slot for a private diagram. It depends on the plan; your **Subscription** page shows how many private and published diagrams you have. If moderation hides a publication, it counts again.

### License

Everything published is **public** under the [**CC BY 4.0**](https://creativecommons.org/licenses/by/4.0/deed.en) license, the same for every publication, so you don't have to pick one. Anyone can view it, **fork** it and adapt it, always crediting the author. It's the MIT license's counterpart for content that isn't software.

Every fork is **recorded**: it counts toward the original publication's forks and keeps where it came from. If someone publishes their fork, its page shows **Fork of "title" by author** with a link to the original (or just the title and author once the original is removed).

!!! warning "Check the data before publishing"
    Anyone can see a published diagram, even without an account. Remove credentials, customer names or internal IPs before publishing it.

To **remove** it, use **Remove from the Community** in the editor or on its page: it stops being public and its stars and comments are deleted. Forks others already made are kept. Since it becomes private again, you need room in your plan for one more private diagram; without it the button is disabled and tells you how many you have: delete one or upgrade your plan.

## Stars, forks and comments

- **Star**: mark the diagrams you like; find them under **My stars**.
- **Fork to my account**: copy the diagram into one of your projects to edit it. It counts for your plan's diagram limit, and the fork's description credits the author, the license and the link. Every publication can be forked.
- **Comments**: public, in Markdown, with one level of replies. The diagram's author shows an **Author** badge. You can delete your comments; the diagram's author can delete any comment on their publication.

## Reports and moderation

Use **Report** on a diagram or comment that breaks the rules (spam, sensitive data, offensive content). With **3 reports** the content is hidden until an administrator reviews it.

Administrators see the **Reports** tab, and on each publication they can **feature** it, **hide** it, **restore** it (which closes its reports) or delete it.
