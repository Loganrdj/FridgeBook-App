import React, { useContext } from 'react';
import "./style.css";
import IngredientInput from './IngredientInput';
import Notifications from './Notifications';
import NotificationWrapper from './NotificationWrapper';
import { GlobalContext } from '../context/GlobalState';
import { useAuth } from '../context/AuthContext';

function Dashboard() {
    const { user } = useAuth();
    const { ingredients, addIngredient } = useContext(GlobalContext);
    const firstName = user ? user.name.split(' ')[0] : '';

    return (
        <div className="fade-in">
            <h1>{firstName ? `Welcome, ${firstName}` : 'Welcome'}</h1>
            <div className="container container-inner-color">
                <div className="row">
                    <div className="col-md-6">
                        <h2>Input your ingredients</h2>
                        <IngredientInput addIngredient={addIngredient}></IngredientInput>
                    </div>
                    <div className="col-md-6">
                        <h2>Notifications</h2>
                        <NotificationWrapper>
                            <Notifications ingredients={ingredients}></Notifications>
                        </NotificationWrapper>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
