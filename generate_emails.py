import pandas as pd
import os
import random

file_path = r"C:\Users\admin\Desktop\ERP-System-Production\Vectra Staffing LLC Employee Directory.xlsx"
output_path = r"C:\Users\admin\.gemini\antigravity-ide\brain\75f691c6-addf-400e-aa13-bc419ca46109\migration_emails.md"

def get_role_instructions(role):
    role = str(role).lower().strip()
    
    tasks = []
    
    if "product manager" in role:
        tasks = [
            "1. Plan the rollout timeline for the Firebase to Supabase migration, ensuring minimal disruption to active users.",
            "2. Audit all current product features running on Firebase and map out equivalent feature requirements for Supabase.",
            "3. Coordinate with the engineering team to prioritize the migration phases and manage tech-debt."
        ]
    elif "ai product manager" in role:
        tasks = [
            "1. Evaluate how moving from Firebase to Supabase (and leveraging pgvector) will impact our AI product roadmap.",
            "2. Align AI feature development schedules with the backend migration timeline.",
            "3. Draft requirements for the AI engineering team on how they should transition their data endpoints to Supabase."
        ]
    elif "ui/ux designer" in role or "ux designer" in role or "product designer" in role:
        tasks = [
            "1. Audit the current user flows tied to Firebase Auth and redesign them to accommodate Supabase Auth requirements.",
            "2. Create wireframes for any new error states, loading screens, or edge cases that may arise during the backend transition.",
            "3. Collaborate with frontend engineers to ensure a seamless visual experience while the underlying database swaps."
        ]
    elif "data engineer" in role:
        tasks = [
            "1. Architect the transition of our NoSQL (Firestore) data models into relational PostgreSQL schemas for Supabase.",
            "2. Build the ETL (Extract, Transform, Load) pipelines required to safely migrate the existing data from Firebase to Supabase without loss.",
            "3. Implement proper PostgreSQL indexing and foreign key constraints to ensure the new database performs optimally."
        ]
    elif "bi analyst" in role or "data analyst" in role or "data visualization" in role or "sql data analyst" in role:
        tasks = [
            "1. Audit our current business intelligence dashboards (Tableau, PowerBI, etc.) that rely on Firebase data.",
            "2. Prepare to rewrite your existing NoSQL reporting queries into optimized SQL statements for PostgreSQL.",
            "3. Build validation reports to ensure data integrity is maintained before and after the engineering team completes the migration."
        ]
    elif "data scientist" in role:
        tasks = [
            "1. Map out the transition for our machine learning model training pipelines to pull data from Supabase PostgreSQL instead of Firebase.",
            "2. Refactor data preprocessing scripts to leverage SQL for heavy data filtering before bringing it into memory.",
            "3. Plan validation tests to guarantee model performance remains consistent after the migration."
        ]
    elif "devops engineer" in role or "network engineer" in role:
        tasks = [
            "1. Update our CI/CD pipelines to support the upcoming Supabase schema migrations and edge function deployments.",
            "2. Translate our existing Firebase Security Rules into PostgreSQL Row Level Security (RLS) policies.",
            "3. Prepare the infrastructure to securely manage and distribute the new Supabase API keys across our environments."
        ]
    elif "generative ai engineer" in role:
        tasks = [
            "1. Design the migration of all our embedding storage and vector search functionalities to Supabase's `pgvector` extension.",
            "2. Update AI integration scripts and API layers to interact with the new PostgreSQL database.",
            "3. Test and optimize retrieval-augmented generation (RAG) performance in a staging environment using Supabase."
        ]
    elif "full stack developer" in role or "software development engineer" in role:
        tasks = [
            "1. Audit the full stack codebase to identify all Firebase Admin and client SDK dependencies that need to be replaced.",
            "2. Lead the effort in refactoring complex backend functions to utilize PostgreSQL's relational integrity instead of Firestore's NoSQL.",
            "3. Build and test the new Supabase authentication flow end-to-end to replace Firebase Auth."
        ]
    elif "software engineer" in role or "software developer" in role or "java developer" in role:
        tasks = [
            "1. Replace all legacy Firebase dependencies in your assigned microservices/repositories with the Supabase SDK.",
            "2. Refactor your data access layers to execute SQL queries via the Supabase client rather than NoSQL document lookups.",
            "3. Implement proper error handling for the new Supabase API responses and ensure smooth data fetching."
        ]
    else:
        tasks = [
            "1. Review your current active tasks and identify any dependencies on the Firebase backend.",
            "2. Prepare to transition your workflows to the new Supabase project environment.",
            "3. Report any potential blockers or issues that this migration might cause in your area of responsibility."
        ]
        
    return "\n".join(tasks)

salutations = [
    "Hi {name},",
    "Hello {name},",
    "Dear {name},",
    "Greetings {name},",
    "Hey {name},"
]

intros = [
    "Management has made the strategic decision to migrate our infrastructure from Firebase to Supabase. This transition will provide us with a robust relational database (PostgreSQL) and enhanced scalability for our future needs.",
    "As we continue to scale, we are moving our database operations from Firebase over to Supabase. Transitioning to PostgreSQL will give us much greater flexibility moving forward.",
    "I'm writing to share that we will be transitioning away from Firebase and moving to Supabase for our data services. This upgrade will significantly improve our long-term scalability and query performance.",
    "We are kicking off a major infrastructure upgrade this week: transitioning from Firebase to Supabase. We believe this move to PostgreSQL will vastly improve our system reliability.",
    "To better support our growing data requirements, leadership has decided to initiate a full migration from Firebase to Supabase.",
    "Our engineering roadmap now officially includes migrating our tech stack from Firebase to Supabase. PostgreSQL is going to open up a lot of new capabilities for us.",
    "We're shifting our infrastructure strategy and moving our primary database from Firebase to Supabase to better accommodate our future needs.",
    "Just a quick update that we're executing a migration from our current Firebase setup over to Supabase to leverage their robust PostgreSQL environment."
]

closings = [
    "Please let me know once you have a chance to complete these updates.",
    "I'd appreciate it if you could work on these updates and keep me posted on your progress.",
    "Whenever you're able to complete these updates, please just drop me a quick note.",
    "Feel free to work on these updates and keep me in the loop as things progress.",
    "Take some time to go through these updates and just let me know when they are done.",
    "Please proceed with these updates at your convenience and keep me updated.",
    "I'd be grateful if you could handle these updates and share your progress when ready.",
    "When you get these updates wrapped up, please just keep me informed."
]

try:
    df = pd.read_excel(file_path, skiprows=1)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# Firebase to Supabase Migration: Task Assignments\n\n")
        
        last_intro = None
        last_closing = None
        for index, row in df.iterrows():
            name = str(row.iloc[2]).strip()
            role = str(row.iloc[3]).strip()
            email = str(row.iloc[5]).strip()
            
            if pd.isna(row.iloc[2]) or name == "nan" or name == "None":
                continue
                
            task_list = get_role_instructions(role)
            salutation = random.choice(salutations).format(name=name)
            
            available_intros = [i for i in intros if i != last_intro]
            intro = random.choice(available_intros)
            last_intro = intro
            
            available_closings = [c for c in closings if c != last_closing]
            closing = random.choice(available_closings)
            last_closing = closing
            
            email_draft = f"""
### To: {name} ({role})
**Email:** {email}
**Subject:** Task Assignment: Executing the Migration from Firebase to Supabase

{salutation}

{intro} 

Currently, our systems are running on Firebase/Firestore. We are now assigning tasks to the team to actually execute this migration. Given your specific role as a **{role}**, you are responsible for the following tasks to ensure a smooth transition:

{task_list}

{closing}

Best regards,

[Your Name]
Project Manager, Vectra Staffing LLC
---
"""
            f.write(email_draft)
            
    print(f"Emails generated successfully at {output_path}")

except Exception as e:
    print(f"Error: {e}")
