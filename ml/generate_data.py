import csv
import random
import numpy as np
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def generate_historical_data(filepath, num_runs=200):
    grades = ['Grade A', 'Grade B', 'Grade C', 'Grade D']
    # Target recipes mapping
    recipes = {
        'Grade A': {'basis_weight': 80.0, 'moisture': 5.0, 'ash': 8.0, 'caliper': 0.10, 'speed': 450.0, 'steam': 2.5, 'stock_flow': 2500.0},
        'Grade B': {'basis_weight': 120.0, 'moisture': 6.0, 'ash': 12.0, 'caliper': 0.15, 'speed': 350.0, 'steam': 3.0, 'stock_flow': 3000.0},
        'Grade C': {'basis_weight': 60.0, 'moisture': 4.5, 'ash': 6.0, 'caliper': 0.08, 'speed': 550.0, 'steam': 2.2, 'stock_flow': 2200.0},
        'Grade D': {'basis_weight': 150.0, 'moisture': 6.5, 'ash': 15.0, 'caliper': 0.18, 'speed': 300.0, 'steam': 3.5, 'stock_flow': 3500.0}
    }

    with open(filepath, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow([
            'run_id', 'from_grade', 'to_grade', 'machine_speed', 'steam_pressure', 
            'stock_flow', 'moisture', 'ash', 'caliper', 'basis_weight_dev', 
            'stabilization_time', 'waste_tons', 'status'
        ])

        for run_id in range(1, num_runs + 1):
            from_g = random.choice(grades)
            to_g = random.choice(grades)
            while to_g == from_g:
                to_g = random.choice(grades)
            
            target = recipes[to_g]
            
            speed_error = random.uniform(-0.15, 0.15)
            steam_error = random.uniform(-0.12, 0.12)
            stock_error = random.uniform(-0.10, 0.10)
            
            speed_factor = 1.0 + speed_error
            stock_factor = 1.0 + stock_error
            steam_factor = 1.0 + steam_error
            
            bw_actual = target['basis_weight'] * (stock_factor / speed_factor)
            bw_dev = ((bw_actual - target['basis_weight']) / target['basis_weight']) * 100.0
            
            moisture_actual = target['moisture'] * (speed_factor / steam_factor)
            moisture_dev = abs(moisture_actual - target['moisture'])
            
            ash_actual = target['ash'] * (stock_factor * (1 + random.uniform(-0.05, 0.05)))
            caliper_actual = target['caliper'] * (stock_factor / steam_factor * (1 + random.uniform(-0.03, 0.03)))
            
            if abs(bw_dev) <= 1.2 and moisture_dev < 0.4:
                status = 'Safe'
                stabilization_time = random.uniform(15, 30)
                waste_tons = stabilization_time * 0.1
            elif abs(bw_dev) <= 2.5 and moisture_dev < 0.8:
                status = 'Warning'
                stabilization_time = random.uniform(30, 60)
                waste_tons = stabilization_time * 0.25
            else:
                status = 'Critical'
                stabilization_time = random.uniform(60, 120)
                waste_tons = stabilization_time * 0.5
            
            speed = target['speed'] * speed_factor
            steam = target['steam'] * steam_factor
            stock = target['stock_flow'] * stock_factor
            moisture = moisture_actual
            ash = ash_actual
            caliper = caliper_actual
            
            writer.writerow([
                run_id, from_g, to_g, round(speed, 2), round(steam, 2),
                round(stock, 2), round(moisture, 2), round(ash, 2), round(caliper, 3),
                round(bw_dev, 2), round(stabilization_time, 1), round(waste_tons, 2), status
            ])

if __name__ == '__main__':
    csv_path = os.path.join(BASE_DIR, 'data', 'historical.csv')
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    generate_historical_data(csv_path)
    print(f"Generated 200 historical grade change runs successfully at {csv_path}")
