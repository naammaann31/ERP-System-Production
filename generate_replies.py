import pandas as pd
import os
import random

file_path = r"C:\Users\admin\Desktop\ERP-System-Production\Vectra Staffing LLC Employee Directory.xlsx"
output_path = r"C:\Users\admin\.gemini\antigravity-ide\brain\75f691c6-addf-400e-aa13-bc419ca46109\migration_replies.md"

def get_role_reply(role):
    role = str(role).lower().strip()
    
    if "product manager" in role:
        return (
            "I've received the migration tasks. I will begin planning the rollout timeline immediately to ensure we have zero downtime for our active users. "
            "I am scheduling an audit of our current Firebase features this afternoon and will map out the equivalent requirements for Supabase. "
            "I'll coordinate with the engineering leads tomorrow morning to prioritize the migration phases. I expect to share a preliminary roadmap by Thursday."
        )
    elif "ai product manager" in role:
        return (
            "Thanks for the update. I'm excited about leveraging `pgvector`. I'll start evaluating the impact on our AI product roadmap today. "
            "I will align our feature development schedules with the backend migration timeline so we don't hit any blockers. "
            "I'll also draft the new data endpoint requirements for the AI engineering team. Expect a status update from me by Friday."
        )
    elif "ui/ux designer" in role or "ux designer" in role or "product designer" in role:
        return (
            "Understood. I will start auditing the user flows tied to Firebase Auth and sketch out the new designs required for Supabase Auth. "
            "I'll also prepare wireframes for any new error states and loading screens that we might need during this backend transition. "
            "I'm setting up a quick sync with the frontend engineers on Wednesday to ensure the visual experience remains seamless. I should have the initial designs ready by early next week."
        )
    elif "data engineer" in role:
        return (
            "Got it. Transitioning from NoSQL to a relational PostgreSQL schema will be a significant shift, but I'm on it. "
            "I will begin architecting the new data models and building the ETL pipelines for the migration immediately. "
            "I'll also ensure proper indexing and foreign key constraints are in place for optimal performance. I'll provide a preliminary timeline for the data migration by Wednesday."
        )
    elif "bi analyst" in role or "data analyst" in role or "data visualization" in role or "sql data analyst" in role:
        return (
            "Thanks for the heads up. I will start auditing our business intelligence dashboards to see which ones are dependent on Firebase. "
            "I am actually looking forward to rewriting these queries in optimized SQL for PostgreSQL, as it should improve our reporting speed. "
            "I'll set up validation reports to ensure data integrity during the switch. I'll have a progress report ready by the end of the week."
        )
    elif "data scientist" in role:
        return (
            "Received. I will begin mapping out the transition for our ML training pipelines to pull directly from Supabase. "
            "Refactoring the preprocessing scripts to leverage SQL filtering will definitely optimize our workflow. "
            "I'll plan the validation tests to ensure our model performance remains consistent. I expect to have the new pipeline architecture mapped out by Thursday."
        )
    elif "devops engineer" in role or "network engineer" in role:
        return (
            "Understood. I will prioritize updating our CI/CD pipelines to accommodate Supabase schema migrations and edge functions. "
            "Translating the Firebase Security Rules into PostgreSQL Row Level Security (RLS) policies will take some careful planning, but I'll start on that today. "
            "I'll also set up the infrastructure to securely manage the new API keys. I will give you a time estimate on the RLS migration by tomorrow."
        )
    elif "generative ai engineer" in role:
        return (
            "Great news. Transitioning our vector search to Supabase's `pgvector` will streamline our architecture. "
            "I'll start designing the migration of our embedding storage today. "
            "I will also update the AI integration scripts and run some tests on RAG performance in the staging environment. Expect an initial performance report by Friday."
        )
    elif "full stack developer" in role or "software development engineer" in role:
        return (
            "Got it. I'll start auditing the codebase to track down all Firebase SDK dependencies so we can rip them out. "
            "I'll lead the charge on refactoring the backend functions to utilize PostgreSQL's relational structure. "
            "I'll also begin building and testing the new Supabase Auth flow. I should have a better estimate on the total refactoring time by Wednesday afternoon."
        )
    elif "software engineer" in role or "software developer" in role or "java developer" in role:
        return (
            "Understood. I will start replacing the legacy Firebase dependencies in my assigned microservices with the Supabase SDK. "
            "I'm ready to refactor the data access layers to execute SQL queries and implement proper error handling for the new API. "
            "I will begin planning my approach and will provide a preliminary status update by Thursday."
        )
    else:
        return (
            "Thanks for the assignment. I will review my active tasks and identify any dependencies on the current Firebase backend. "
            "I'll prepare to transition my workflows to the new Supabase environment and will let you know if I anticipate any blockers. "
            "I will send over a time estimate by the end of the week."
        )

openings = [
    "Hi Project Management Team,",
    "Hello PMT,",
    "Hi there,",
    "Dear PMT,",
    "Thanks for the email."
]

closings = [
    "Best regards,\n{name}",
    "Thanks,\n{name}",
    "Cheers,\n{name}",
    "Looking forward to the migration,\n{name}"
]

try:
    df = pd.read_excel(file_path, skiprows=1)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# Firebase to Supabase Migration: Employee Replies\n\n")
        f.write("Below are the drafted email replies from the employees back to the Project Management Team acknowledging their tasks for the Supabase migration.\n\n")
        
        for index, row in df.iterrows():
            name = str(row.iloc[2]).strip()
            role = str(row.iloc[3]).strip()
            email = str(row.iloc[5]).strip()
            
            if pd.isna(row.iloc[2]) or name == "nan" or name == "None":
                continue
                
            reply_body = get_role_reply(role)
            opening = random.choice(openings)
            closing = random.choice(closings).format(name=name)
            
            reply_draft = f"""
### From: {name} ({role})
**To:** Project Management Team <pmt@vectrastaffing.com>
**Subject:** Re: Task Assignment: Executing the Migration from Firebase to Supabase

{opening}

{reply_body} 

Please let me know if you need anything else in the meantime. I will reach out if I need access to the staging credentials.

{closing}
---
"""
            f.write(reply_draft)
            
    print(f"Replies generated successfully at {output_path}")

except Exception as e:
    print(f"Error: {e}")
