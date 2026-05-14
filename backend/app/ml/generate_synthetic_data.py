import pandas as pd
import numpy as np
import os

# defining how many rows of fake data we need to train the model
# prof wants robust data so im doing 10,000 rows. should be enough to get 99% accuracy.
NUM_SAMPLES_PER_CLASS = 5000

def generate_ai_paste_data(num_samples):
    # AI pastes everything instantly. literally impossible for a human to do this.
    data = {
        # wpm is insanely high cos it pastes 1000 words in 1 second
        "wpm": np.random.randint(400, 5000, num_samples),
        # AI doesnt make typos so zero backspaces
        "deletions": np.zeros(num_samples, dtype=int),
        # AI doesnt stop to think
        "pauses": np.zeros(num_samples, dtype=int),
        # flight time between keys is basically the processor clock speed (0ms to 3ms)
        "avg_iki": np.random.uniform(0.1, 3.5, num_samples),
        "session_seconds": np.random.randint(1, 5, num_samples),
        "label": ["AI-GENERATED"] * num_samples
    }
    return pd.DataFrame(data)

def generate_suspicious_data(num_samples):
    # this simulates a student who types a few sentences normally, then gets lazy and pastes the rest from ChatGPT
    data = {
        # wpm is artificially high but not impossible
        "wpm": np.random.normal(loc=140, scale=20, size=num_samples).astype(int),
        # maybe a few typos before the paste happens
        "deletions": np.random.randint(0, 5, num_samples),
        # very few pauses
        "pauses": np.random.randint(0, 3, num_samples),
        # avg IKI is skewed heavily by the 0ms paste intervals mixed with normal typing
        "avg_iki": np.random.normal(loc=45, scale=15, size=num_samples),
        "session_seconds": np.random.randint(10, 45, num_samples),
        "label": ["SUSPICIOUS"] * num_samples
    }
    
    df = pd.DataFrame(data)
    # cleaning up negative numbers cos normal distribution sometimes dips below zero
    df['wpm'] = df['wpm'].clip(lower=80)
    df['avg_iki'] = df['avg_iki'].clip(lower=5.0)
    return df

def main():
    print("Generating synthetic AI attack vectors...")
    
    ai_df = generate_ai_paste_data(NUM_SAMPLES_PER_CLASS)
    suspicious_df = generate_suspicious_data(NUM_SAMPLES_PER_CLASS)
    
    # sticking them together into one massive dataframe
    final_df = pd.concat([ai_df, suspicious_df], ignore_index=True)
    
    # shuffling the rows so the ML model doesnt memorize the order and overfit
    final_df = final_df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # making sure the directory exists before saving
    os.makedirs("data", exist_ok=True)
    
    file_path = "data/synthetic_attacks.csv"
    final_df.to_csv(file_path, index=False)
    
    print(f"Success bro. Generated {len(final_df)} rows of synthetic data saved to {file_path}")
    print(final_df.head())

if __name__ == "__main__":
    main()